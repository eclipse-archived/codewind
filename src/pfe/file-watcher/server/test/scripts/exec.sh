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
    -t # Test type, currently support 'local' and 'kube' - Mandatory
    -s # Test suite, currently support 'functional' - Mandatory
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

    mkdir -p $TEST_OUTPUT_DIR \
    && docker exec -it $CODEWIND_CONTAINER_ID bash -c "cd /file-watcher/server; npm install --only=dev" \
    && docker cp $TEST_DIR/test $CODEWIND_CONTAINER_ID:$TEST_DIR_CONTAINER

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}Test setup failed. ${RESET}\n"
        exit 1
    fi
    
    # Clone projects to workspace
    declare -a PROJECT_URLS
    PROJECT_URLS["codewindtestpython"]="https://github.com/microclimate-dev2ops/SVTPythonTemplate"
    PROJECT_URLS["codewindtestgo"]="https://github.com/microclimate-dev2ops/microclimateGoTemplate"
    PROJECT_URLS["codewindtestlagom"]="https://github.com/microclimate-dev2ops/lagomJavaTemplate"
    PROJECT_URLS["codewindtestspring"]="https://github.com/microclimate-dev2ops/springJavaTemplate"
    PROJECT_URLS["codewindtestmicroprofile"]="https://github.com/microclimate-dev2ops/javaMicroProfileTemplate"
    PROJECT_URLS["codewindtestnodejs"]="https://github.com/microclimate-dev2ops/nodeExpressTemplate.git"
    PROJECT_URLS["codewindtestswift"]="https://github.com/microclimate-dev2ops/swiftTemplate"
    
    echo -e "${BLUE}Cloning projects to $CW_DIR/codewind-workspace ${RESET}\n"
    for PROJECT_NAME in ${!PROJECT_URLS[@]}; do
        echo -e "${BLUE}Cloning ${PROJECT_URLS[$PROJECT_NAME]}. ${RESET}\n"
        clone $PROJECT_NAME $CW_DIR/codewind-workspace ${PROJECT_URLS[$PROJECT_NAME]}
    done
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

while getopts "t:s:h" OPTION; do
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
            # Check if test bucket argument is corrent
            if [[ ($TEST_SUITE != "functional") ]]; then
                echo -e "${RED}Test bucket argument is not correct. ${RESET}\n"
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
if [[ (-z $TEST_TYPE) ]]; then
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
