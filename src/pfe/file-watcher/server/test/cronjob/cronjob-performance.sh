#!/usr/bin/env bash

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
BLUE='\033[0;36m'
RESET='\033[0m'

# Set up variables
CW_DIR=~/codewind
CW_TEST_DIR=$CW_DIR/src/pfe/file-watcher/server/test/performance-test
PERFORMANCE_DATA_DIR=$CW_TEST_DIR/data

UPSTREAM_REPO=git@github.com:eclipse/codewind.git
UPSTREAM_BRANCH="master"
RELEASE_REPO=$UPSTREAM_REPO
RELEASE_BRANCH=$UPSTREAM_BRANCH

TEST_ENV="local"
CLEAN_RUN="n"
POST_CLEANUP="n"
ITERATIONS=3

# Make all options mandatory to ensure cronjob admin knows what exectly each cronjob does, it's for debug purpose
function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    --upstream-repo     The upstream repo to clone codewind from - default: git@github.com:eclipse/codewind.git
    --upstream-branch   The upstream branch to clone codewind from - default: master
    --release-repo      The release repo to test against - default: git@github.com:eclipse/codewind.git
    --release-branch    The release branch to test against - default: master
    --environment       The test environment to run in - default: local
    --clean-run         Flag to enable a clean test run - default: n
    --post-clean        Flag to perform a post clean up - default: n
    --iterations        Number of iterations to evaluate the performance on - default: 3
    -h | --help         Display the man page
EOF
}

while :; do
    case $1 in
        --upstream-repo=?*)
        UPSTREAM_REPO=${1#*=}
        ;;
        --upstream-branch=?*)
        UPSTREAM_BRANCH=${1#*=}
        ;;
        --release-repo=?*)
        RELEASE_REPO=${1#*=}
        ;;
        --release-branch=?*)
        RELEASE_BRANCH=${1#*=}
        ;;
        --environment=?*)
        TEST_ENV=${1#*=}
        ;;
        --clean-run=?*)
        CLEAN_RUN=${1#*=}
        ;;
        --post-clean=?*)
        POST_CLEANUP=${1#*=}
        ;;
        --iterations=?*)
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


rm -rf $CW_DIR \
&& git clone $UPSTREAM_REPO -b "$UPSTREAM_BRANCH" \
&& cd $CW_TEST_DIR

DATE_NOW=$(date +"%d-%m-%Y")
TIME_NOW=$(date +"%H.%M.%S")
PERFORMANCE_RUN_LOG="performance-run.log"
PERFORMANCE_RUN_DIR=~/performance_test_logs/$TEST_ENV/$RELEASE_BRANCH/$DATE_NOW/$TIME_NOW/

mkdir -p $PERFORMANCE_RUN_DIR

echo -e "${BLUE}Kicking off perfomance test run for $TEST_ENV test ... ${RESET}"
./performance-run.sh --environment=$TEST_ENV --repo=$RELEASE_REPO --release=$RELEASE_BRANCH --clean-run=$CLEAN_RUN --post-clean=$POST_CLEANUP --iterations=${ITERATIONS} |& tee "$PERFORMANCE_RUN_DIR/$PERFORMANCE_RUN_LOG"

if [[ ($? -ne 0) ]]; then
    echo -e "${RED}Cronjob has failed. ${RESET}\n"
    exit 1
fi

DATA_SRC_DIR="$PERFORMANCE_DATA_DIR/$TEST_ENV/$RELEASE_BRANCH"
echo -e "${BLUE}Copying over performance data from $DATA_SRC_DIR to $PERFORMANCE_RUN_DIR  ... ${RESET}"
cp -r $DATA_SRC_DIR/* $PERFORMANCE_RUN_DIR

if [[ ($? -ne 0) ]]; then
    echo -e "${RED}Failed to copy data. Please check the source directory for data in $PERFORMANCE_DATA_DIR/$RELEASE_BRANCH ${RESET}\n"
    exit 1
fi
