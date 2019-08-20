#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Set up variables
cd ../../../../../
CW_DIR=$(pwd)
cd -
WEBSERVER_FILE="$CW_DIR/src/pfe/iterative-dev/test/microclimate-test/scripts/webserver.sh"

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    -t # Test type, currently supports 'local' or 'kube' - Mandatory
    -s # Test suite, currently supports 'functional' - Mandatory
    -d # Clean workspace, currently supports 'y' or 'n' - Mandatory
    -h # Display the man page
EOF
}

function clone () {
    curl -H "Content-type: application/json" -d '{"projectName": "'$1'", "parentPath": "'$2'", "url": "'$3'"}' "http://localhost:9090/api/v1/projects"
}

function setup {
    DATE_NOW=$(date +"%d-%m-%Y")
    TIME_NOW=$(date +"%H.%M.%S")
    BUCKET_NAME=turbine-$TEST_SUITE
    TEST_DIR=$CW_DIR/src/pfe/file-watcher/server
    TEST_DIR_CONTAINER=/file-watcher/server
    TEST_OUTPUT_DIR=~/test_results/$TEST_SUITE/$DATE_NOW/$TIME_NOW
    TEST_OUTPUT=$TEST_OUTPUT_DIR/test_output.xml
    TEST_LOG=$TEST_OUTPUT_DIR/$TEST_SUITE-test.log
    CODEWIND_CONTAINER_ID=$(docker ps | grep codewind-pfe-amd64 | cut -d " " -f 1)
    PROJECTS_CLONE_DATA_FILE="./resources/projects-clone-data"

    mkdir -p $TEST_OUTPUT_DIR \
    && docker exec -it $CODEWIND_CONTAINER_ID bash -c "cd /file-watcher/server; npm install --only=dev" \
    && docker cp $TEST_DIR/test $CODEWIND_CONTAINER_ID:$TEST_DIR_CONTAINER

    if [[ ($? -ne 0) ]]; then
        echo -e "${RED}Test setup failed. ${RESET}\n"
        exit 1
    fi

    # Clean up workspace if needed
    if [[ ($CLEAN_WORKSPACE == "y") ]]; then
        echo -e "${BLUE}Cleaning up workspace. ${RESET}\n"
        rm -rf $CW_DIR/codewind-workspace/*
    fi

    # Clone projects to workspace
    echo -e "${BLUE}Cloning projects to $CW_DIR/codewind-workspace. ${RESET}"
    while IFS= read -r LINE; do
        PROJECT_NAME=$(echo $LINE | cut -d "=" -f 1)
        PROJECT_URL=$(echo $LINE | cut -d "=" -f 2)
        echo -e "\n\nProject name is: $PROJECT_NAME, project URL is $PROJECT_URL"
        echo -e "${BLUE}Cloning $PROJECT_URL. ${RESET}"
        clone $PROJECT_NAME $CW_DIR/codewind-workspace $PROJECT_URL

        if [[ ($? -ne 0) ]]; then
            echo -e "${RED}Cloning project $PROJECT_NAME failed. ${RESET}\n"
            exit 1
        fi
    done < "$PROJECTS_CLONE_DATA_FILE"
}

function run {
    docker exec -it $CODEWIND_CONTAINER_ID bash -c "cd /file-watcher/server; JUNIT_REPORT_PATH=/test_output.xml npm run $TEST_SUITE:test:xml" | tee $TEST_LOG
    docker cp $CODEWIND_CONTAINER_ID:/test_output.xml $TEST_OUTPUT
    echo -e "${BLUE}Test logs available at: $TEST_LOG ${RESET}"

    # Cronjob machines need to set up CRONJOB_RUN=y to push test restuls to dashboard
    if [[ (-n $CRONJOB_RUN) ]]; then
        echo -e "${BLUE}Upload test results to the test dashboard. ${RESET}\n"
        if [[ (-z $DASHBOARD_IP) ]]; then
            echo -e "${RED}Dashboard IP is required to upload test results. ${RESET}\n"
            exit 1
        fi
        $WEBSERVER_FILE $TEST_OUTPUT_DIR > /dev/null
        curl --header "Content-Type:text/xml" --data-binary @$TEST_OUTPUT --insecure "https://$DASHBOARD_IP/postxmlresult/$BUCKET_NAME/test" > /dev/null
    fi
}

while getopts "t:s:d:h" OPTION; do
    case "$OPTION" in
        t) 
            TEST_TYPE=$OPTARG
            # Check if test type argument is corrent
            if [[ ($TEST_TYPE != "local") && ($TEST_TYPE != "kube") ]]; then
                echo -e "${RED}Test type argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        s)
            TEST_SUITE=$OPTARG
            # Check if test suite argument is corrent
            if [[ ($TEST_SUITE != "functional") ]]; then
                echo -e "${RED}Test suite argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        d)
            CLEAN_WORKSPACE=$OPTARG
            # Check if clean workspace argument is corrent
            if [[ ($CLEAN_WORKSPACE != "y") && ($CLEAN_WORKSPACE != "n") ]]; then
                echo -e "${RED}Clean workspace argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        *)
            usage
            exit 0
            ;;
    esac
done

# Check mandatory arguments have been set up
if [[ (-z $TEST_TYPE) || (-z $TEST_SUITE) || (-z $CLEAN_WORKSPACE) ]]; then
    echo -e "${RED}Mandatory arguments are not set up. ${RESET}\n"
    usage
    exit 1
fi

# Setup test cases run
echo -e "${BLUE}Starting pre-test setup. ${RESET}\n"
setup

# Run test cases
# echo -e "${BLUE}\nRunning $TEST_SUITE tests. ${RESET}\n"
# run
