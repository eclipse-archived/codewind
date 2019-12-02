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

#CODEWIND_REPO=git@github.com:eclipse/codewind.git
CODEWIND_REPO=git@github.com:ssh24/codewind.git
RELEASE_DIR="performance-test-codewind"

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    --clean-run     To perform a clean run. Default: n
    --environment   The test environment. Default: local
    --post-clean    To perform a post clean up. Default: n 
    --release       The release branch to use. Default: master
    --iteration     Number of iterations to run the performance test. Default: 10
    -h | --help     Display the man page
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
        -c|--clean-run=?*)
        CLEAN_RUN=${1#*=}
        ;;
        -p|--post-clean=?*)
        POST_CLEAN=${1#*=}
        ;;
        -r|--release=?*)
        RELEASE_BRANCH=${1#*=}
        ;;
        -e|--environment=?*)
        TEST_ENV=${1#*=}
        ;;
        -i|--iteration=?*)
        ITERATIONS=${1#*=}
        ;;
        -h|--help)
        usage
        exit
        ;;
        *) break
    esac
    shift
done

# always use the master test source to run against the release branch
TEST_DIR=$(cd .. && pwd)

# in local we don't need a clean run from the test as it is done as a pre setup for the performance test
if [ "$CLEAN_RUN" == "y" ] && [ "$TEST_ENV" == "local" ]; then
    CLEAN_RUN="n"
fi

echo -e "${CYAN}> Cloning release branch ${RESET}"
rm -rf $RELEASE_DIR
echo "Release branch is $RELEASE_BRANCH"
git clone $CODEWIND_REPO -b "$RELEASE_BRANCH" $RELEASE_DIR
displayMsg $? "Failed to clone from release branch." true

echo -e "${CYAN}> Creating data directory ${RESET}"
mkdir -p "$CURR_DIR/data/$TEST_ENV/$RELEASE_BRANCH"
displayMsg $? "Failed to create data directory." true

export TURBINE_PERFORMANCE_TEST=${RELEASE_BRANCH}

for run in $(seq 1 $ITERATIONS);
do
    echo -e "${CYAN}> Iteration: $run ${RESET}"

    echo -e "${CYAN}> Switching to release directory ${RESET}"
    cd $RELEASE_DIR
    displayMsg $? "Failed to switch release directory." true

    echo -e "${CYAN}> Stopping codewind ${RESET}"
    ./stop.sh
    displayMsg $? "Failed to stop codewind." true

    echo -e "${CYAN}> Running docker system prune ${RESET}"
    docker system prune -af
    displayMsg $? "Failed to perform docker system prune." false

    echo -e "${CYAN}> Running docker image prune ${RESET}"
    docker image prune -af
    displayMsg $? "Failed to perform docker image prune." false

    echo -e "${CYAN}> Starting codewind ${RESET}"
    ./run.sh
    displayMsg $? "Failed to start codewind." true

    cd $TEST_DIR

    ./test.sh -t $TEST_ENV -s functional -c $CLEAN_RUN -p $POST_CLEAN
done
