#!/usr/bin/env bash

#*******************************************************************************
# Copyright (c) 2019 IBM Corporation and others.
# All rights reserved. This program and the accompanying materials
# are made available under the terms of the Eclipse Public License v2.0
# which accompanies this distribution, and is available at
# http://www.eclipse.org/legal/epl-v20.html
#
# Contributors:
#     IBM Corporation - initial API and implementation
#*******************************************************************************

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

cd /c
TEST_WD=$(pwd)

CW_CONTAINER="codewind-pfe"
DEFAULT_IMG="eclipse/codewind-pfe-amd64"
IN_CONTAINER_PATH="/file-watcher/server"

IMAGE_TAG=""
TEST_REPO="https://github.com/eclipse/codewind.git"
TEST_BRANCH="master"
CW_DIR="$TEST_WD/codewind"
PROJECT_PATH="$TEST_WD/projects"
CLEAN_UP=""

TEST_DIR="$CW_DIR/src/pfe/file-watcher/server/test"
PROJECTS_CLONE_DATA_FILE="$TEST_DIR/resources/projects-clone-data"

DATE_NOW=$(date +"%d-%m-%Y")
TIME_NOW=$(date +"%H.%M.%S")
TEST_OUTPUT_DIR=~/test_results/$DATE_NOW/$TIME_NOW
TEST_OUTPUT=$TEST_OUTPUT_DIR/test_output.xml
TEST_LOG=$TEST_OUTPUT_DIR/windows-functional-test.log

WEBSERVER_FILE="$TEST_DIR/scripts/webserver.sh"

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
	-i # Source code image - Optional
	-l # Local codewind directory - Optional
	-r # Test code repo - Optional
	-b # Test code branch - Optional
    -c # Clean up test resources - Optional
	-h # Display the man page
EOF
}

while getopts "i:r:b:c:h" OPTION; do
    case "$OPTION" in
        i)
            IMAGE_TAG=$OPTARG
            ;;
		l) 
            CW_DIR=$OPTARG
            ;;
		r)
			if [[ ! -d $CW_DIR ]]; then
				TEST_REPO=$OPTARG
			fi
            ;;
		b)
			if [[ ! -d $CW_DIR ]]; then
				TEST_BRANCH=$OPTARG
			fi
			;;
		c)
			CLEAN_UP=$OPTARG
            ;;
        *)
            usage
            exit 0
            ;;
    esac
done

echo -e "${GREEN}✔ Setting up test from $TEST_WD ... ${RESET}\n"

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

function createProject() {
   ./$EXECUTABLE_NAME project create --url $1 $2
}

function copyToPFE() {
   docker cp $1 $CW_CONTAINER:"/codewind-workspace"
}

echo -e "${BLUE}>> Downloading latest installer ... ${RESET}"
EXECUTABLE_NAME="cwctl"
curl -X GET http://download.eclipse.org/codewind/codewind-installer/master/latest/cwctl-win.exe --output $EXECUTABLE_NAME
checkExitCode $? "Failed to download latest installer."

echo -e "${BLUE}>> Giving executable permission to installer ... ${RESET}"
chmod +x $EXECUTABLE_NAME
checkExitCode $? "Failed to give correct permission to run installer."

echo -e "${BLUE}>> Cleaning up docker system ... ${RESET}"
docker system prune -af
checkExitCode $? "Failed to clean up docker system."

echo -e "${BLUE}>> Stopping existing codewind ... ${RESET}"
./cwctl stop-all
checkExitCode $? "Failed to stop existing codewind."

echo -e "${BLUE}>> Installing latest codewind ... ${RESET}"
./cwctl install -t latest
checkExitCode $? "Failed to install latest codewind."

if [[ ! -z "$IMAGE_TAG" ]]; then
	echo -e "${BLUE}>> Pull down custom image $IMAGE_TAG ... ${RESET}"
	docker pull $IMAGE_TAG
	checkExitCode $? "Failed to pull down custom image."
	
	echo -e "${BLUE}>> Tagging custom image: $IMAGE_TAG -> $DEFAULT_IMG  ... ${RESET}"
	docker tag $IMAGE_TAG $DEFAULT_IMG
	checkExitCode $? "Failed to tag custom image."
fi

echo -e "${BLUE}>> Starting codewind ... ${RESET}"
./cwctl start
checkExitCode $? "Failed to start codewind."

if [[ ! -d $CW_DIR ]]; then
	echo -e "${BLUE}>> Downloading latest test ... ${RESET}"
	git clone $TEST_REPO -b $TEST_BRANCH
	checkExitCode $? "Failed to download latest tests."
fi

echo -e "${BLUE}>> Creating test projects directory ... ${RESET}"
mkdir -p $PROJECT_PATH
checkExitCode $? "Failed to create test projects directory."

CTR=0
# Read project git config
while IFS='\n' read -r LINE; do
    PROJECT_CLONE[$CTR]=$LINE
    let CTR++
done < "$PROJECTS_CLONE_DATA_FILE"
    
# Clone projects to workspace
for i in "${PROJECT_CLONE[@]}"; do
    PROJECT_NAME=$(echo $i | cut -d "=" -f 1)
    PROJECT_URL=$(echo $i | cut -d "=" -f 2)

    echo -e "${BLUE}>> Creating project $PROJECT_NAME from $PROJECT_URL in "$PROJECT_PATH/$PROJECT_NAME" ${RESET}"
    createProject $PROJECT_URL "$PROJECT_PATH/$PROJECT_NAME"
	checkExitCode $? "Failed to created project $PROJECT_NAME."

	echo -e "${BLUE}>> Copying $PROJECT_NAME to PFE container ${RESET}"
	copyToPFE "$PROJECT_PATH/$PROJECT_NAME"
	checkExitCode $? "Failed to copy project to PFE container."
done

echo -e "${BLUE}>> Copying test files over to container ... ${RESET}"
docker cp $TEST_DIR $CW_CONTAINER:$IN_CONTAINER_PATH
checkExitCode $? "Failed to copy test files over."

echo -e "${BLUE}>> Installing test dependencies ... ${RESET}"
docker exec -i $CW_CONTAINER bash -c "cd /file-watcher/server; npm install --only=dev"
checkExitCode $? "Failed to install test dependencies."

echo -e "${BLUE}>> Creating test results directory ... ${RESET}"
mkdir -p $TEST_OUTPUT_DIR
checkExitCode $? "Failed to create test results directory."

echo -e "${BLUE}>> Starting test  ... ${RESET}"
docker exec -i $CW_CONTAINER bash -c "cd /file-watcher/server; JUNIT_REPORT_PATH=/test_output.xml npm run functional:test:xml" | tee $TEST_LOG
checkExitCode $? "Failed to run tests."

echo -e "${BLUE}>> Test logs available at: $TEST_LOG ${RESET}"

echo -e "${BLUE}>> Copying test results from container ... ${RESET}"
docker cp $CW_CONTAINER:/test_output.xml $TEST_OUTPUT
checkExitCode $? "Failed to copy test results from container."

if [[ ! -z "$CLEAN_UP" ]]; then
	echo -e "${BLUE}>> Cleaning up test directory ... ${RESET}"
	rm -rf $CW_DIR
	rm -rf $PROJECT_PATH
	checkExitCode $? "Failed to clean up test directory."
fi

if [[ (-n $CRONJOB_RUN) ]]; then
	echo -e "${BLUE}>> Uploading test results to the test dashboard. ${RESET}\n"
	if [[ (-z $DASHBOARD_IP) ]]; then
        echo -e "${RED}✖ Dashboard IP is required to upload test results. ${RESET}\n"
        exit 1
    fi
    $WEBSERVER_FILE $TEST_OUTPUT_DIR > /dev/null
    curl --header "Content-Type:text/xml" --data-binary @$TEST_OUTPUT --insecure "https://$DASHBOARD_IP/postxmlresult/turbine-windows/test" > /dev/null
fi
