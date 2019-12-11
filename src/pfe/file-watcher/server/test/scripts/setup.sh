#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

source ./scripts/utils.sh

# Set up variables
cd ../../../../../
CW_DIR=$(pwd)
cd -

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: [-<option letter> <option value> | -h]
Options:
    -t # Test type, currently supports 'local' or 'kube' - Mandatory
    -f # Setup function, currently supports 'install' or 'uninstall' - Mandatory
    -h # Display the man page
EOF
}

# Install function does the following things
# 1 Build Codewind images
# 2 Run Codewind containers
function install {
    if [ $TEST_TYPE == "local" ]; then
        cd $CW_DIR
        $CW_DIR/run.sh
        cd -
        if [[ $? -ne 0 ]]; then
            echo -e "${RED}Codewind setup has failed. ${RESET}\n"
            exit 1
        fi
    elif [ $TEST_TYPE == "kube" ]; then
        # Generate the Che Access Token for Che User Authentication
        generateCheAccessToken

        # Create Codewind workspace with Che API
        echo -e "${BLUE}Creating Che Codewind Workspace ${RESET}\n"
        DEFAULT_DEVFILE="https://raw.githubusercontent.com/eclipse/codewind-che-plugin/master/devfiles/latest/devfile.yaml"

        if [[ ! -z $USER_DEVFILE ]]; then
            DEFAULT_DEVFILE="$USER_DEVFILE"
        fi
        echo -e "${BLUE}Downloading devfile from:${GREEN} $DEFAULT_DEVFILE ${RESET}\n"
        
        HTTPSTATUS=$(curl $DEFAULT_DEVFILE | curl -s --header "Content-Type: text/yaml" --header 'Authorization: Bearer '"$CHE_ACCESS_TOKEN"'' --request POST --data-binary @- -D- -o/dev/null $CHE_ENDPOINT/api/workspace/devfile?start-after-create=true 2>/dev/null | sed -n 3p | cut -d ' ' -f2) 
        if [[ $HTTPSTATUS -ne 201 ]]; then
            echo -e "${RED}Codewind workspace setup has failed with HTTPSTATUS $HTTPSTATUS. ${RESET}\n"
            exit 1
        fi
        # Wait until the Codewind pod is up and running
        POD_RUNNING=0
        while [ $POD_RUNNING -eq 0 ]; do
	        RESULT="$( kubectl get po --selector=app=codewind-pfe )"
	        if [[ $RESULT = *"Running"* ]]; then
		        POD_RUNNING=1
                echo -e "${GREEN}Codewind pod is running... ${RESET}\n"
            elif [[ -z $RESULT ]]; then
                echo -e "${BLUE}No resources found. Waiting for Codewind pod to be created... ${RESET}\n"
	        elif [[ $RESULT = *"Failure"* || $RESULT = *"Unknown"* || $RESULT = *"ImagePullBackOff"* || $RESULT = *"CrashLoopBackOff"* || $RESULT = *"PostStartHookError"* ]]; then
		        echo -e "${RED}Codewind pod failed to start ${RESET}\n"
		        exit 1
	        fi
	        sleep 1
        done
    fi
}

# Uninstall function does the following things
# 1 Remove Codewind and Codewind app containers
# 2 Remove Codewind and Codewind app images
function uninstall {
    if [ $TEST_TYPE == "local" ]; then
        $CW_DIR/stop.sh

        if [[ $? -ne 0 ]]; then
            echo -e "${RED}Cleanup is failed. ${RESET}\n"
            exit 1
        fi
    elif [ $TEST_TYPE == "kube" ]; then
        # Generate the Che Access Token for Che User Authentication
        generateCheAccessToken

        # Get the Codewind Workspace ID
        CW_POD="$( kubectl get po --selector=app=codewind-pfe --show-labels | tail -n 1 )"
        echo -e "${BLUE}Codewind Pod: $CW_POD ${RESET}\n"
        if [[ $CW_POD =~ codewindWorkspace=.*, ]]; then
            RE_RESULT=${BASH_REMATCH}
            WORKSPACE_ID=$(echo $RE_RESULT | cut -d "=" -f 2 | cut -d "," -f 1)

            echo -e "${BLUE}Codewind Workspace ID: $WORKSPACE_ID ${RESET}\n"

            # Stop the Codewind Workspace
            echo -e "${BLUE}Stopping the Codewind Workspace ${RESET}\n"
            HTTPSTATUS=$(curl -I --header 'Authorization: Bearer '"$CHE_ACCESS_TOKEN"'' --request DELETE $CHE_ENDPOINT/api/workspace/$WORKSPACE_ID/runtime 2>/dev/null | head -n 1| cut -d$' ' -f2)
            if [[ $HTTPSTATUS -ne 204 ]]; then
                echo -e "${RED}Codewind workspace has failed to stop with HTTPSTATUS $HTTPSTATUS. Will attempt to remove the workspace... ${RESET}\n"
            fi
            # We must wait for the workspace to stop before removing it, otherwise the workspace removal fails
            echo -e "${BLUE}Sleeping for 10s to allow the workspace to stop before removing it ${RESET}\n"
            sleep 10

            # Remove the Codewind Workspace
            echo -e "${BLUE}Removing the Codewind Workspace ${RESET}\n"
            HTTPSTATUS=$(curl -I --header 'Authorization: Bearer '"$CHE_ACCESS_TOKEN"'' --request DELETE $CHE_ENDPOINT/api/workspace/$WORKSPACE_ID 2>/dev/null | head -n 1| cut -d$' ' -f2)
            if [[ $HTTPSTATUS -ne 204 ]]; then
                echo -e "${RED}Codewind workspace has failed to be removed with HTTPSTATUS $HTTPSTATUS... ${RESET}\n"
                exit 1
            fi

            echo -e "${GREEN}Codewind should be removed momentarily... ${RESET}\n"
        else
            echo -e "${BLUE}No Codewind pod found ${BLUE}\n"
        fi
    fi
}

while getopts "t:f:h" OPTION; do
    case "$OPTION" in
        t) 
            TEST_TYPE=$OPTARG
            # Check if test type argument is correct
            if [[ ($TEST_TYPE != "local") && ($TEST_TYPE != "kube") ]]; then
                echo -e "${RED}Test type argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        f)
            SETUP_FUNCTION=$OPTARG
            # Check if setup function argument is correct
            if [[ ($SETUP_FUNCTION != "install") && ($SETUP_FUNCTION != "uninstall") ]]; then
                echo -e "${RED}Setup function argument is not correct. ${RESET}\n"
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

# Check if the mandatory arguments have been set up
if [[ (-z $TEST_TYPE) || (-z $SETUP_FUNCTION) ]]; then
    echo -e "${RED}Mandatory arguments are not set up. ${RESET}\n"
    usage
    exit 1
fi

if [[ $SETUP_FUNCTION == "install" ]];then
    install
elif [[ ($SETUP_FUNCTION == "uninstall") ]];then
    uninstall
fi
