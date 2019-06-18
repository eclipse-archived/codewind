#!/bin/bash

MC_DIR=~/microclimate
MC_REPO_URL=git@github.ibm.com:dev-ex/microclimate.git
MC_NIGHTLY_RUN_DIR=$MC_DIR/src/pfe/iterative-dev/test/idc-test/scripts
HOSTNAME=`hostname -f`

# Colours for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Delete previous test cases and test scripts
echo -e "${BLUE}Deleting previous test cases and test scripts... ${RESET}"
if [ -d $MC_DIR ]; then
   rm -rf $MC_DIR
   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully deleted previous test cases and test scripts. ${RESET}"
   else
      echo -e "${RED}Failed to delete previous test cases and test scripts. ${RESET}"
      exit 1
   fi
else
   echo -e "${GREEN}There are no previous test cases and test scripts. ${RESET}"
fi

# Download test cases and test scripts from github 
echo -e "${BLUE}Downloading test cases and test scripts from github... ${RESET}" 
git clone $MC_REPO_URL
if [ $? -eq 0 ]; then
   echo -e "${GREEN}Successfully downloaded test cases and test scripts from github. ${RESET}\n"
else
   echo -e "${RED}Failed to download test cases and test scripts from github. ${RESET}\n"
   exit 1
fi

# Clean up previous microclimate related containers and images
echo -e "${BLUE}Cleaning up previous microclimate... ${RESET}"
$MC_NIGHTLY_RUN_DIR/cleanup_idc.sh local

if [ $? -ne 0 ]; then
   echo -e "${RED}Failed to clean up previous idc. ${RESET}\n"
   exit 1
else
   echo -e "${GREEN}Successfully cleaned up previous idc. ${RESET}\n"
fi

# Test idc standalone
echo -e "${BLUE}Running idc test... ${RESET}"
$MC_NIGHTLY_RUN_DIR/run_idc_tests.sh
echo -e "${GREEN}Finished running idc tests, test results reporting can be viewed here http://$HOSTNAME ${RESET}\n"

# Clean up current idc related containers and images
echo -e "${BLUE}Cleaning up current idc... ${RESET}"
$MC_NIGHTLY_RUN_DIR/cleanup_idc.sh local

if [ $? -ne 0 ]; then
   echo -e "${RED}Fail to clean up current microclimate. ${RESET}\n"
   exit 1
else
   echo -e "${GREEN}Successfully cleaned up current microclimate. ${RESET}\n"
fi

# Delete current test cases and test scripts
echo -e "${BLUE}Deleting current test cases and test scripts... ${RESET}"
if [ -d $MC_DIR ]; then
   rm -rf $MC_DIR
   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully deleted current test cases and test scripts. ${RESET}"
   else
      echo -e "${RED}Failed to delete current test cases and test scripts. ${RESET}"
      exit 1
   fi
else
   echo -e "${GREEN}There are no current test cases and test scripts. ${RESET}"
fi

echo "Test results are showing in http://$HOSTNAME" 
