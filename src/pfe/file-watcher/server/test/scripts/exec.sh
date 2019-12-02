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

function checkExitCode() {
	exit_code=$1
	error_msg=$2
	if [[ $exit_code -eq 0 ]]; then
		echo -e "${GREEN}✔ Done. ${RESET}\n"
	else
		echo -e "${RED}✖ $error_msg  ${RESET}\n"
		exit 1
	fi
}

function downloadCwctl() {
    echo -e "${BLUE}>> Downloading latest installer ... ${RESET}"
    EXECUTABLE_NAME="cwctl"
    HOST_OS=$(uname -a)
    if [[ "$HOST_OS" =~ "Darwin" ]]; then
        extension="macos"
    elif [[ "$HOST_OS" =~ "Linux" ]]; then
        extension="linux"
    fi
    echo "Extension is $extension"
    curl -X GET http://download.eclipse.org/codewind/codewind-installer/master/latest/cwctl-$extension --output $EXECUTABLE_NAME
    checkExitCode $? "Failed to download latest installer."

    echo -e "${BLUE}>> Giving executable permission to installer ... ${RESET}"
    chmod +x $EXECUTABLE_NAME
    checkExitCode $? "Failed to give correct permission to run installer."
}

function createProject() {
   ./$EXECUTABLE_NAME project create --url $1 $2
}

function copyToPFE() {
    if [ $TEST_TYPE == "local" ]; then
        docker cp $1 $CODEWIND_CONTAINER_ID:"$PROJECT_PATH"
    elif [ $TEST_TYPE == "kube" ]; then
        kubectl cp $1 $CODEWIND_POD_ID:"$PROJECT_PATH"
    fi
}

function setup {
    PROJECT_DIR="$CW_DIR/src/pfe/file-watcher/server/test/projects"
    DATE_NOW=$(date +"%d-%m-%Y")
    TIME_NOW=$(date +"%H.%M.%S")
    BUCKET_NAME=turbine-$TEST_TYPE-$TEST_SUITE
    TURBINE_SERVER_DIR=$CW_DIR/src/pfe/file-watcher/server
    TEST_DIR=$TURBINE_SERVER_DIR/test
    TURBINE_DIR_CONTAINER=/file-watcher
    TEST_OUTPUT_DIR=~/test_results/$TEST_TYPE/$TEST_SUITE/$DATE_NOW/$TIME_NOW
    TEST_OUTPUT=$TEST_OUTPUT_DIR/test_output.xml
    PROJECTS_CLONE_DATA_FILE="$CW_DIR/src/pfe/file-watcher/server/test/resources/projects-clone-data"
    TEST_LOG=$TEST_OUTPUT_DIR/$TEST_TYPE-$TEST_SUITE-test.log
    TURBINE_NPM_INSTALL_CMD="cd /file-watcher/server; npm install --only=dev"
    TURBINE_EXEC_TEST_CMD="cd /file-watcher/server; JUNIT_REPORT_PATH=/test_output.xml IMAGE_PUSH_REGISTRY_ADDRESS=${IMAGE_PUSH_REGISTRY_ADDRESS} IMAGE_PUSH_REGISTRY_NAMESPACE=${IMAGE_PUSH_REGISTRY_NAMESPACE} npm run $TEST_SUITE:test:xml"

    mkdir -p $TEST_OUTPUT_DIR

    if [ $TEST_TYPE == "local" ]; then
        CODEWIND_CONTAINER_ID=$(docker ps | grep codewind-pfe-amd64 | cut -d " " -f 1)
        docker cp $TURBINE_SERVER_DIR $CODEWIND_CONTAINER_ID:$TURBINE_DIR_CONTAINER \
        && docker exec -i $CODEWIND_CONTAINER_ID bash -c "$TURBINE_NPM_INSTALL_CMD"
    elif [ $TEST_TYPE == "kube" ]; then
        CODEWIND_POD_ID=$(kubectl get po --selector=app=codewind-pfe --show-labels | tail -n 1 | cut -d " " -f 1)
        kubectl cp $TURBINE_SERVER_DIR $CODEWIND_POD_ID:$TURBINE_DIR_CONTAINER \
        && kubectl exec -i $CODEWIND_POD_ID -- bash -c "$TURBINE_NPM_INSTALL_CMD"
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
        PROJECT_PATH="/codewind-workspace"
    elif [ $TEST_TYPE == "kube" ]; then
        PROJECT_PATH=/projects
    fi

    downloadCwctl

    echo -e "${BLUE}>> Creating test projects directory ... ${RESET}"
    mkdir -p $PROJECT_DIR
    checkExitCode $? "Failed to create test projects directory."

    CTR=0
    # Read project git config
    echo -e "${BLUE}Creating projects to $PROJECT_DIR. ${RESET}"
    while IFS='\n' read -r LINE; do
        PROJECT_CLONE[$CTR]=$LINE
        let CTR++
    done < "$PROJECTS_CLONE_DATA_FILE"
    
    # Clone projects to workspace
    for i in "${PROJECT_CLONE[@]}"; do
        PROJECT_NAME=$(echo $i | cut -d "=" -f 1)
        PROJECT_URL=$(echo $i | cut -d "=" -f 2)

        echo -e "${BLUE}>> Creating project $PROJECT_NAME from $PROJECT_URL in "$PROJECT_DIR/$PROJECT_NAME" ${RESET}"
        createProject $PROJECT_URL "$PROJECT_DIR/$PROJECT_NAME"
	    checkExitCode $? "Failed to created project $PROJECT_NAME."

        echo -e "${BLUE}>> Copying $PROJECT_NAME to PFE container ${RESET}"
	    copyToPFE "$PROJECT_DIR/$PROJECT_NAME"
	    checkExitCode $? "Failed to copy project to PFE container."
    done
}

function run {
    if [ $TEST_TYPE == "local" ]; then
        docker exec -i $CODEWIND_CONTAINER_ID bash -c "$TURBINE_EXEC_TEST_CMD" | tee $TEST_LOG
        docker cp $CODEWIND_CONTAINER_ID:/test_output.xml $TEST_OUTPUT
    elif [ $TEST_TYPE == "kube" ]; then
        kubectl exec -i $CODEWIND_POD_ID -- bash -c "$TURBINE_EXEC_TEST_CMD" | tee $TEST_LOG
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

    echo -e "${BLUE}>> Cleaning up test projects ... ${RESET}"
	rm -rf $PROJECT_DIR
	checkExitCode $? "Failed to clean up test directory."
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
