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
WEBSERVER_FILE="$CW_DIR/src/pfe/file-watcher/server/test/scripts/webserver.sh"

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
    if [ $TEST_TYPE == "local" ]; then
        curl -H "Content-type: application/json" -d '{"projectName": "'$1'", "parentPath": "'$2'", "url": "'$3'"}' "http://localhost:9090/api/v1/projects"
    elif [ $TEST_TYPE == "kube" ]; then
        kubectl exec -i $CODEWIND_POD_ID -- curl -H "Content-type: application/json" -d '{"projectName": "'$1'", "parentPath": "'$2'", "url": "'$3'"}' "https://localhost:9191/api/v1/projects" --insecure
    fi
}

function setup {
    DATE_NOW=$(date +"%d-%m-%Y")
    TIME_NOW=$(date +"%H.%M.%S")
    BUCKET_NAME=turbine-$TEST_TYPE-$TEST_SUITE
    TURBINE_SERVER_DIR=$CW_DIR/src/pfe/file-watcher/server
    TEST_DIR=$TURBINE_SERVER_DIR/test
    TURBINE_DIR_CONTAINER=/file-watcher
    TEST_OUTPUT_DIR=~/test_results/$TEST_TYPE/$TEST_SUITE/$DATE_NOW/$TIME_NOW
    TEST_OUTPUT=$TEST_OUTPUT_DIR/test_output.xml
    PROJECTS_CLONE_DATA_FILE="./resources/projects-clone-data"
    TEST_LOG=$TEST_OUTPUT_DIR/$TEST_TYPE-$TEST_SUITE-test.log

    mkdir -p $TEST_OUTPUT_DIR

    if [ $TEST_TYPE == "local" ]; then
        CODEWIND_CONTAINER_ID=$(docker ps | grep codewind-pfe-amd64 | cut -d " " -f 1)
        docker cp $TURBINE_SERVER_DIR $CODEWIND_CONTAINER_ID:$TURBINE_DIR_CONTAINER \
        && docker exec -it $CODEWIND_CONTAINER_ID bash -c "cd /file-watcher/server; npm install --only=dev"
    elif [ $TEST_TYPE == "kube" ]; then
        CODEWIND_POD_ID=$(kubectl get po --selector=app=codewind-pfe --show-labels | tail -n 1 | cut -d " " -f 1)
        kubectl cp $TURBINE_SERVER_DIR $CODEWIND_POD_ID:$TURBINE_DIR_CONTAINER \
        && kubectl exec -it $CODEWIND_POD_ID -- bash -c "cd /file-watcher/server; npm install --only=dev"
    fi

    if [[ ($? -ne 0) ]]; then
        echo -e "${RED}Test setup failed. ${RESET}\n"
        exit 1
    fi

    # Clean up workspace if needed
    if [[ ($CLEAN_WORKSPACE == "y") ]]; then
        if [ $TEST_TYPE == "local" ]; then
            echo -e "${BLUE}Cleaning up workspace. ${RESET}\n"
            rm -rf $CW_DIR/codewind-workspace/*
        fi
    fi

    if [ $TEST_TYPE == "local" ]; then
        PROJECT_PATH=$CW_DIR/codewind-workspace
    elif [ $TEST_TYPE == "kube" ]; then
        PROJECT_PATH=/projects
    fi

    CTR=0
    # Read project git config
    echo -e "${BLUE}Cloning projects to $CW_DIR/codewind-workspace. ${RESET}"
    while IFS='\n' read -r LINE; do
        PROJECT_CLONE[$CTR]=$LINE
        let CTR++
    done < "$PROJECTS_CLONE_DATA_FILE"
    
    # Clone projects to workspace
    for i in "${PROJECT_CLONE[@]}"; do
	    PROJECT_NAME=$(echo $i | cut -d "=" -f 1)
        PROJECT_URL=$(echo $i | cut -d "=" -f 2)
        echo -e "\n\nProject name is: $PROJECT_NAME, project URL is $PROJECT_URL"
        echo -e "${BLUE}Cloning $PROJECT_URL. ${RESET}"
        clone $PROJECT_NAME $PROJECT_PATH $PROJECT_URL

        if [[ ($? -ne 0) ]]; then
            echo -e "${RED}Cloning project $PROJECT_NAME failed. ${RESET}\n"
            exit 1
        fi
    done
}

function run {
    if [ $TEST_TYPE == "local" ]; then
        docker exec -it $CODEWIND_CONTAINER_ID bash -c "cd /file-watcher/server; JUNIT_REPORT_PATH=/test_output.xml npm run $TEST_SUITE:test:xml" | tee $TEST_LOG
        docker cp $CODEWIND_CONTAINER_ID:/test_output.xml $TEST_OUTPUT
    elif [ $TEST_TYPE == "kube" ]; then
        kubectl exec -it $CODEWIND_POD_ID -- bash -c "cd /file-watcher/server; JUNIT_REPORT_PATH=/test_output.xml npm run $TEST_SUITE:test:xml" | tee $TEST_LOG
        kubectl cp $CODEWIND_POD_ID:/test_output.xml $TEST_OUTPUT
    fi
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
echo -e "${BLUE}\nRunning $TEST_SUITE tests. ${RESET}\n"
run
