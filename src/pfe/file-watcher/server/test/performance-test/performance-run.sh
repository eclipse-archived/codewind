#!/bin/bash
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
CYAN='\e[36m'
YELLOW='\e[33m'
MAGENTA='\e[35m'
RESET='\033[0m'

CURR_DIR=$(pwd)

CLEAN_RUN="n"
POST_CLEAN="n"
RELEASE_BRANCH="master"
TEST_ENV="local"
ITERATIONS=10
CONVERT_ONLY=false

CODEWIND_REPO=git@github.com:eclipse/codewind.git
RELEASE_DIR="performance-test-codewind"
USER_DEVFILE=
TEST_PATH="src/pfe/file-watcher/server/test"

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    --clean-run         To perform a clean run. Default: n
    --devfile           The devfile to set the workspace on kube with. Required if environment is "kube"
    --environment       The test environment. Default: local
    --post-clean        To perform a post clean up. Default: n 
    --release           The release branch to use. Default: master
    --iterations        Number of iterations to run the performance test. Default: 10
    --report-only       Convert data to csv only. Will not run performance test and use existing data json on path. Default: false
    --repo              The upstream repo to use. Default: git@github.com:eclipse/codewind.git
    -h | --help         Display the man page
EOF
}

function displayMsg() {
	exit_code=$1
	error_msg=$2
    exit=$3

	if [[ $exit_code -eq 0 ]]; then
		echo -e "${GREEN}✔ Done. ${RESET}\n"
	else
		echo -e "${RED}✖ $error_msg  ${RESET}\n"
		if [[ $exit == true ]]; then
            exit 1
        fi
	fi
}

while :; do
    case $1 in
        --clean-run=?*)
        CLEAN_RUN=${1#*=}
        ;;
        --post-clean=?*)
        POST_CLEAN=${1#*=}
        ;;
        --release=?*)
        RELEASE_BRANCH=${1#*=}
        ;;
        --environment=?*)
        TEST_ENV=${1#*=}
        ;;
        --iterations=?*)
        ITERATIONS=${1#*=}
        ;;
        --report-only)
        CONVERT_ONLY=true
        ;;
        --repo=?*)
        CODEWIND_REPO=${1#*=}
        ;;
        --devfile=?*)
        USER_DEVFILE=${1#*=}
        ;;
        -h|--help)
        usage
        exit
        ;;
        *) break
    esac
    shift
done

# in local we don't need a clean run from the test as it is done as a pre setup for the performance test
if [ "$CLEAN_RUN" == "y" ] && [ "$TEST_ENV" == "local" ]; then
    CLEAN_RUN="n"
fi

if [ "$TEST_ENV" == "kube" ] && [ -z "$USER_DEVFILE" ]; then
    displayMsg 1 "User devfile is a required parameter on kube". true
fi

export TURBINE_PERFORMANCE_TEST=${RELEASE_BRANCH}
export TEST_TYPE=${TEST_ENV}

if [[ $CONVERT_ONLY == false ]]; then
    echo -e "${CYAN}> Cloning release branch ${RESET}"
    rm -rf $RELEASE_DIR
    git clone $CODEWIND_REPO -b "$RELEASE_BRANCH" $RELEASE_DIR
    displayMsg $? "Failed to clone from release branch." true

    echo -e "${CYAN}> Creating data directory ${RESET}"
    TARGET_DIR="$CURR_DIR/data/$TEST_ENV/$RELEASE_BRANCH"
    rm -rf $TARGET_DIR
    mkdir -p $TARGET_DIR
    displayMsg $? "Failed to create data directory." true

    echo -e "${CYAN}> Switching to release directory ${RESET}"
    cd "$CURR_DIR/$RELEASE_DIR/$TEST_PATH"
    displayMsg $? "Failed to switch release directory." true

    for run in $(seq 1 $ITERATIONS);
    do
        echo -e "${CYAN}> Iteration: $run ${RESET}"

        echo -e "${CYAN}> Cleaning up docker ${RESET}"
        docker system prune -af
        displayMsg $? "Failed to clean up docker." true

        PERFORMANCE_DATA_DIR=${TARGET_DIR} NAMESPACE=${NAMESPACE} CLUSTER_IP=${CLUSTER_IP} CLUSTER_PORT=${CLUSTER_PORT} CLUSTER_USER=${CLUSTER_USER} CLUSTER_PASSWORD=${CLUSTER_PASSWORD} ./test.sh -t $TEST_ENV -s functional -c $CLEAN_RUN -p $POST_CLEAN
    done
fi

cd $CURR_DIR

echo -e "${CYAN}> Checking for virtualenv ${RESET}"
virtualenv --version > /dev/null 2>&1
displayMsg $? "Missing virtualenv command. Please install and try again." true

echo -e "${CYAN}> Checking for python ${RESET}"
python --version > /dev/null 2>&1
displayMsg $? "Missing python command. Please install and try again." true

echo -e "${CYAN}> Checking for pip ${RESET}"
pip > /dev/null 2>&1
displayMsg $? "Missing pip command. Please install and try again." true

echo -e "${CYAN}> Creating python virtual environment ${RESET}"
virtualenv venv -p $(which python) > /dev/null 2>&1
displayMsg $? "Failed to create up python virtual environment. Please try again." true

echo -e "${CYAN}> Activating python virtual environment ${RESET}"
source venv/bin/activate > /dev/null 2>&1
displayMsg $? "Failed to activate up python virtual environment. Please try again." true

echo -e "${CYAN}> Installing required python dependencies: pandas ${RESET}"
pip install pandas > /dev/null 2>&1
displayMsg $? "Failed to install pandas module. Please try again." true

echo -e "${CYAN}> Installing required python dependencies: numpy ${RESET}"
pip install numpy > /dev/null 2>&1
displayMsg $? "Failed to install numpy module. Please try again." true

echo -e "${CYAN}> Running data analyzer script ${RESET}"
PY_FILE="analyze-data.py"
python $PY_FILE
displayMsg $? "Failed to run python script. Please install and try again." true

echo -e "${CYAN}> Deactivating python virtual environment ${RESET}"
deactivate venv > /dev/null 2>&1
displayMsg $? "Failed to deactivate up python virtual environment. Please try again." true
