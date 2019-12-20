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
    EXECUTABLE_NAME="cwctl_"$TEST_TYPE
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

function setupInternalRegistryCredentials() {
    # Adapted from https://github.com/eclipse/codewind-che-plugin/blob/master/scripts/che-setup.sh
    echo -e "${BLUE}Setting up the Internal Registry Credentials ... ${RESET}"
    OC_VERSION=$( oc version 2>&1 )
    if [[ "$OC_VERSION" =~ "Client Version: version.Info{Major:\"4\"" ]]; then
        REGISTRY_SECRET_ADDRESS="image-registry.openshift-image-registry.svc:5000"
    else
        REGISTRY_SECRET_ADDRESS="docker-registry.default.svc:5000"
    fi

    REGISTRY_SECRET_USERNAME=turbine-test-sa

    oc delete sa $REGISTRY_SECRET_USERNAME
    oc create sa $REGISTRY_SECRET_USERNAME

    oc policy add-role-to-user system:image-builder system:serviceaccount:$NAMESPACE:$REGISTRY_SECRET_USERNAME

    ENCODED_TOKEN=$(oc get secret $(oc describe sa $REGISTRY_SECRET_USERNAME | tail -n 2 | head -n 1 | awk '{$1=$1};1') -o json | jq ".data.token")
    REGISTRY_SECRET_PASSWORD=$( node ./scripts/utils.js decode $ENCODED_TOKEN )
    if [[ ($? -ne 0) ]]; then
        echo -e "${RED}Test setup failed during Registry Secret's base64 credential decode. ${RESET}\n"
        exit 1
    fi
}

function setupRegistrySecret() {
    if [[ $INTERNAL_REGISTRY == "y" ]]; then
        setupInternalRegistryCredentials
    fi
    echo -e "${BLUE}Setting up the Registry Secret ... ${RESET}"
    ENCODED_CREDENTIALS=$( node ./scripts/utils.js encode $REGISTRY_SECRET_USERNAME $REGISTRY_SECRET_PASSWORD )
    if [[ ($? -ne 0) ]]; then
        echo -e "${RED}Test setup failed during Registry Secret's base64 credential encode. ${RESET}\n"
        exit 1
    fi

    REGISTRY_SECRET_SETUP_CURL_API="curl -d '{\"address\": \"$REGISTRY_SECRET_ADDRESS\", \"credentials\": \"$ENCODED_CREDENTIALS\"}' -H \"Content-Type: application/json\" -X POST https://localhost:9191/api/v1/registrysecrets -k"
    kubectl exec -i $CODEWIND_POD_ID -- bash -c "$REGISTRY_SECRET_SETUP_CURL_API"
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
    TURBINE_DIR_CONTAINER=/file-watcher/server
    TEST_RUNS_DATE_DIR=~/test_results/$DATE_NOW
    TEST_OUTPUT_DIR=$TEST_RUNS_DATE_DIR/$TEST_TYPE/$TEST_SUITE/$TIME_NOW
    TEST_OUTPUT=$TEST_OUTPUT_DIR/test_output.xml
    PROJECTS_CLONE_DATA_FILE="$CW_DIR/src/pfe/file-watcher/server/test/resources/projects-clone-data"
    TEST_LOG=$TEST_OUTPUT_DIR/$TEST_TYPE-$TEST_SUITE-test.log
    TURBINE_NPM_INSTALL_CMD="cd /file-watcher/server; npm install --only=dev"
    PERFORMANCE_TEST_DIR="mkdir -p /file-watcher/server/test/performance-test/data/$TEST_TYPE/$TURBINE_PERFORMANCE_TEST"

    mkdir -p $TEST_OUTPUT_DIR

    # Copy the test files to the PFE container/pod and run npm install
    echo -e "${BLUE}Copying over the Filewatcher dir to the Codewind container/pod ... ${RESET}"
    if [ $TEST_TYPE == "local" ]; then
        CODEWIND_CONTAINER_ID=$(docker ps | grep codewind-pfe-amd64 | cut -d " " -f 1)
        docker cp $TEST_DIR $CODEWIND_CONTAINER_ID:$TURBINE_DIR_CONTAINER \
        && docker exec -i $CODEWIND_CONTAINER_ID bash -c "$TURBINE_NPM_INSTALL_CMD"
    elif [ $TEST_TYPE == "kube" ]; then
        CODEWIND_POD_ID=$(kubectl get po --selector=app=codewind-pfe --show-labels | tail -n 1 | cut -d " " -f 1)
        kubectl cp $TEST_DIR $CODEWIND_POD_ID:$TURBINE_DIR_CONTAINER \
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

    if [ $TEST_TYPE == "kube" ]; then
        # Set up registry secrets (docker config) in PFE container/pod
        setupRegistrySecret
    fi
}

function run {
    TURBINE_EXEC_TEST_CMD="cd /file-watcher/server; JUNIT_REPORT_PATH=/test_output.xml IMAGE_PUSH_REGISTRY_ADDRESS=${REGISTRY_SECRET_ADDRESS} IMAGE_PUSH_REGISTRY_NAMESPACE=${IMAGE_PUSH_REGISTRY_NAMESPACE} NAMESPACE=${NAMESPACE} TURBINE_PERFORMANCE_TEST=${TURBINE_PERFORMANCE_TEST} npm run $TEST_SUITE:test:xml"

    if [ $TEST_TYPE == "local" ]; then
        if [ ! -z $TURBINE_PERFORMANCE_TEST ]; then
            echo -e "${BLUE}>> Creating data directory in PFE docker if it does not exist already ... ${RESET}"
            docker exec -i $CODEWIND_CONTAINER_ID bash -c "$PERFORMANCE_TEST_DIR"
            checkExitCode $? "Failed to create data directory in PFE docker."

            if [[ -f "$PERFORMANCE_DATA_DIR"/performance-data.json ]]; then
                echo -e "${BLUE}>> Copying data.json file back to docker container ... ${RESET}"
                docker cp "$PERFORMANCE_DATA_DIR"/performance-data.json $CODEWIND_CONTAINER_ID:/file-watcher/server/test/performance-test/data/$TEST_TYPE/$TURBINE_PERFORMANCE_TEST
                checkExitCode $? "Failed to copy data.json file to docker container."
            fi
        fi

        docker exec -i $CODEWIND_CONTAINER_ID bash -c "$TURBINE_EXEC_TEST_CMD" | tee $TEST_LOG
        docker cp $CODEWIND_CONTAINER_ID:/test_output.xml $TEST_OUTPUT
    elif [ $TEST_TYPE == "kube" ]; then
        if [ ! -z $TURBINE_PERFORMANCE_TEST ]; then
            echo -e "${BLUE}>> Creating data directory in PFE kube if it does not exist already ... ${RESET}"
            kubectl exec -i $CODEWIND_POD_ID -- bash -c "$PERFORMANCE_TEST_DIR"
            checkExitCode $? "Failed to create data directory in PFE kube."

            if [[ -f "$PERFORMANCE_DATA_DIR"/performance-data.json ]]; then
                echo -e "${BLUE}>> Copying data.json file back to docker container ... ${RESET}"
                kubectl cp "$PERFORMANCE_DATA_DIR"/performance-data.json $CODEWIND_POD_ID:/file-watcher/server/test/performance-test/data/$TEST_TYPE/$TURBINE_PERFORMANCE_TEST
                checkExitCode $? "Failed to copy data.json file to docker container."
            fi
        fi

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
        $WEBSERVER_FILE $TEST_RUNS_DATE_DIR > /dev/null
        curl --header "Content-Type:text/xml" --data-binary @$TEST_OUTPUT --insecure "https://$DASHBOARD_IP/postxmlresult/$BUCKET_NAME/test" > /dev/null
    fi

    echo -e "${BLUE}>> Cleaning up test projects ... ${RESET}"
	rm -rf $PROJECT_DIR
	checkExitCode $? "Failed to clean up test directory."

    if [ $TEST_TYPE == "local" ] & [ ! -z $TURBINE_PERFORMANCE_TEST ]; then
        echo -e "${BLUE}>> Copy back data.json file back to host VM ... ${RESET}"
        docker cp $CODEWIND_CONTAINER_ID:/file-watcher/server/test/performance-test/data/$TEST_TYPE/$TURBINE_PERFORMANCE_TEST/performance-data.json "$PERFORMANCE_DATA_DIR"
        checkExitCode $? "Failed to copy data.json file to host VM local."
    elif [ $TEST_TYPE == "kube" ] & [ ! -z $TURBINE_PERFORMANCE_TEST ]; then
        echo -e "${BLUE}>> Copy back data.json file back to host VM ... ${RESET}"
        kubectl cp $CODEWIND_POD_ID:/file-watcher/server/test/performance-test/data/$TEST_TYPE/$TURBINE_PERFORMANCE_TEST/performance-data.json "$PERFORMANCE_DATA_DIR"
        checkExitCode $? "Failed to copy data.json file to host VM on kube."
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
