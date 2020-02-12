#!/bin/bash
#*******************************************************************************
# Copyright (c) 2020 IBM Corporation and others.
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

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
CURR_DIR=$(pwd)

source $DIR/../scripts/utils.sh
cd $CURR_DIR

CLEAN_RUN="n"
POST_CLEAN="n"
RELEASE_BRANCH="master"
TEST_ENV="local"
ITERATIONS=3
CONVERT_ONLY=false

CODEWIND_REPO=git@github.com:eclipse/codewind.git
export RELEASE_DIR="performance-test-codewind"
export TEST_PATH="src/pfe/file-watcher/server/test"
USER_DEVFILE=${USER_DEVFILE}

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    --clean-run         To perform a clean run. Default: n
    --environment       The test environment. Default: local
    --post-clean        To perform a post clean up. Default: n 
    --release           The release branch to use. Default: master
    --iterations        Number of iterations to run the performance test. Default: 3
    --report-only       Convert data to csv only. Will not run performance test and use existing data json on path. Default: false
    --repo              The upstream repo to use. Default: git@github.com:eclipse/codewind.git
    -h | --help         Display the man page
EOF
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
        -h|--help)
        usage
        exit
        ;;
        *) break
    esac
    shift
done

if [ "$TEST_ENV" != "local" ] && [ "$TEST_ENV" != "kube" ] && [ "$TEST_ENV" != "both" ]; then
    checkExitCode 1 "Test can only be ran on local or kube or both environment" true
fi

export TURBINE_PERFORMANCE_TEST=${RELEASE_BRANCH}

if [[ $CONVERT_ONLY == false ]]; then
    echo -e "${CYAN}> Cloning release branch ${RESET}"
    rm -rf $RELEASE_DIR
    git clone $CODEWIND_REPO -b "$RELEASE_BRANCH" $RELEASE_DIR
    checkExitCode $? "Failed to clone from release branch." true

    if [ -z $DATE_NOW ]; then
        export DATE_NOW=$(date +"%d-%m-%Y")
    fi
    if [ -z $TIME_NOW ]; then
        export TIME_NOW=$(date +"%H.%M.%S")
    fi

    echo -e "${CYAN}> Creating projects first before splitting test environment runs ${RESET}"
    EXECUTABLE_PATH="$CURR_DIR/$RELEASE_DIR/$TEST_PATH"
    $CURR_DIR/$RELEASE_DIR/$TEST_PATH/scripts/create-project.sh
    checkExitCode $? "Failed to create projects." true

    if [ "$TEST_ENV" == "both" ]; then
        for testEnv in "local" "kube";
            do
                echo -e "${CYAN}> Kicked off run for $testEnv. Tail logs to see progress from "$LOGS_DATA_DIR/performance-run-$testEnv.log" ${RESET}"
                LOGS_DATA_DIR=~/performance_test_logs/$testEnv/$RELEASE_BRANCH/$DATE_NOW/$TIME_NOW
                mkdir -p $LOGS_DATA_DIR
                ./runner.sh --environment=$testEnv --iterations=$ITERATIONS --clean-run=$CLEAN_RUN --post-clean=$POST_CLEAN --create-projects=n > "$LOGS_DATA_DIR/performance-run-$testEnv.log" &
            done
    else
        LOGS_DATA_DIR=~/performance_test_logs/$TEST_ENV/$RELEASE_BRANCH/$DATE_NOW/$TIME_NOW
        mkdir -p $LOGS_DATA_DIR
        ./runner.sh --environment=$TEST_ENV --iterations=$ITERATIONS --clean-run=$CLEAN_RUN --post-clean=$POST_CLEAN --create-projects=n |& tee "$LOGS_DATA_DIR/performance-run-$TEST_ENV.log"
    fi
else
    if [ "$TEST_ENV" == "both" ]; then
        ./runner.sh --environment="local" --report-only &
        ./runner.sh --environment="kube" --report-only &
    else
        ./runner.sh --environment=$TEST_ENV --report-only
    fi
fi
