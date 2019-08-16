#!/bin/bash

# Colours for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

BRANCH=$1
TEST_BUCKET=$2
DEVELOPMENT_RUN=$3

# Check arguments
echo -e "${BLUE}Checking arguments... ${RESET}"

# Check if the first argument is correct
if [[ $BRANCH && $BRANCH == "master" ]]; then
   echo -e "${BLUE}First Argument is: $BRANCH ${RESET}" 
   echo -e "${BLUE}Codewind will be installed from the latest release.${RESET}"
elif [[ $BRANCH && $BRANCH != "master" ]]; then
   echo -e "${BLUE}First Argument is: $BRANCH ${RESET}"
   echo -e "${BLUE}Codewind will be installed from the release: $BRANCH ${RESET}"
else
   echo -e "${RED}>> Invalid Branch Passed: $BRANCH.${RESET}"
   exit 1
fi

# Check if the second argument is correct
if [[ $TEST_BUCKET && ($TEST_BUCKET == "unit" || $TEST_BUCKET == "functional") ]]; then
   echo -e "${BLUE}Second Argument is: $TEST_BUCKET ${RESET}" 
   echo -e "${BLUE}Test bucket selected to run: $TEST_BUCKET ${RESET}"
else
   echo -e "${RED}>> Invalid Test Bucket Passed: $TEST_BUCKET.${RESET}"
   exit 1
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if [[ -n $TRAVIS_PULL_REQUEST ]]; then
   "$DIR/cronjob-pr.sh" $TEST_BUCKET
else
   "$DIR/cronjob-vm.sh" $BRANCH $TEST_BUCKET $DEVELOPMENT_RUN
fi
