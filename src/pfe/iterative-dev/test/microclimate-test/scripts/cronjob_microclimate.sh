#!/bin/bash

# Test for Windows Host OS
isMicroclimateRunningOnWindows() {
   [[ $(uname -r) =~ Microsoft$ ]]
}

if isMicroclimateRunningOnWindows; then
   MC_DIR=/c/microclimate
else
   MC_DIR=~/microclimate
fi

MC_REPO_URL=git@github.ibm.com:dev-ex/microclimate.git
MC_NIGHTLY_RUN_DIR=$MC_DIR/src/pfe/iterative-dev/test/microclimate-test/scripts
HOSTNAME=`hostname -f`
Drelease=$1
DtestType=$2
MC_INSTALL_ARCH=$3
DoptionType=$4

# Colours for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Check arguments
echo -e "${BLUE}Checking arguments... ${RESET}"

if [[ ! $# -gt 2 || ! $# -lt 5 ]]; then
   echo -e "${RED}Wrong Arguments. Please enter:${RESET}"
   echo "Options for Argument 1:"
   echo "master"
   echo "   - install the latest microclimate"
   echo "<release tag>"
   echo "   - install the latest microclimate from <release tag>"
   echo "   - please check the artifactory for a list of release tags"
   echo "Options for Argument 2:"
   echo "local"
   echo "   - test microclimate locally"
   echo "icp"
   echo "   - test microclimate in ICP"
   echo "Options for Argument 3:"
   echo "x86_64"
   echo "   - test microclimate on x86_64"
   echo "ppc64le"
   echo "   - test microclimate on ppc64le"
   echo "Options for Argument 4 (Optional):"
   echo "cache"
   echo "   - create test cache"
   echo "quarantine"
   echo "   - run quarantine suite"
   exit 1
fi

# Check if the first argument is correct
if [[ $1 && $1 == "master" ]]; then
   echo -e "${BLUE}First Argument is: $Drelease ${RESET}" 
   echo -e "${BLUE}Microclimate will be installed from the latest release. ${RESET}"
elif [[ $1 && $1 != "master" ]]; then
   echo -e "${BLUE}First Argument is: $Drelease ${RESET}"
   echo -e "${BLUE}Microclimate will be installed from the release: $Drelease ${RESET}"
fi

# Check if the second argument is correct
if [[ ($2 != "local" && $2 != "icp") ]]; then
   echo -e "${RED}Second argument is not correct, please enter from the following: ${RESET}"
   echo "Options:"
   echo "local"
   echo "   - test microclimate locally"
   echo "icp"
   echo "   - test microclimate in ICP"
   exit 1
else
   echo -e "${GREEN}Second Argument is correct. ${RESET}\n"
fi

# Check if the third argument is correct
if [[ ($3 != "x86_64" && $3 != "ppc64le") ]]; then
   echo -e "${RED}Third argument is not correct, please enter from the following: ${RESET}"
   echo "Options:"
   echo "x86_64"
   echo "   - test microclimate on x86_64"
   echo "ppc64le"
   echo "   - test microclimate on ppc64le"
   exit 1
else
   echo -e "${GREEN}Third Argument is correct. ${RESET}\n"
fi

# Check if the fourth argument is present, which is optional
if [[ $4 && $4 == "cache" ]]; then
   echo -e "${GREEN}Fourth Argument is correct. Cache option has been selected. ${RESET}\n"
   echo -e "${GREEN}Microclimate will create Application cache images only. ${RESET}\n"
elif [[ $4 && $4 == "quarantine" ]]; then
   echo -e "${GREEN}Fourth Argument is correct. Quarantine option has been selected. ${RESET}\n"
   echo -e "${GREEN}The Quarantine suite will be executed. ${RESET}\n"
elif [[ $4 && $4 == "development" ]]; then
   DEVELOPMENT_RUN="true"
   echo -e "${GREEN}Fourth Argument is correct. Development run option has been selected. ${RESET}\n"
elif [[ $4 && $4 != "cache" ]] || [[ $4 && $4 != "quarantine" ]]; then
   echo -e "${RED}Fourth Argument is not correct. At this moment, file watcher test only supports the cache and the quarantine option. Exiting... ${RESET}\n"
   exit 1
fi

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
if isMicroclimateRunningOnWindows; then
   cd /c/
fi 
git clone $MC_REPO_URL
if [ $? -eq 0 ]; then
   echo -e "${GREEN}Successfully downloaded test cases and test scripts from github. ${RESET}\n"
else
   echo -e "${RED}Failed to download test cases and test scripts from github. ${RESET}\n"
   exit 1
fi
if isMicroclimateRunningOnWindows; then
   cd ~
fi 

# Stop and uninstall microclimate
# Clean up previous microclimate related containers and images
# Delete previous microclimate related folders and files
echo -e "${BLUE}Cleaning up previous microclimate... ${RESET}"
$MC_NIGHTLY_RUN_DIR/uninstall_microclimate.sh $DtestType $MC_INSTALL_ARCH $DoptionType

if [ $? -ne 0 ]; then
   echo -e "${RED}Failed to clean up previous microclimate. ${RESET}\n"
   exit 1
else
   echo -e "${GREEN}Successfully cleaned up previous microclimate. ${RESET}\n"
fi

# Download microclimate
# Install microclimate
# Start microcliamte
echo -e "${BLUE}Setting up microclimate... ${RESET}"
$MC_NIGHTLY_RUN_DIR/install_microclimate.sh git $Drelease $DtestType $MC_INSTALL_ARCH

if [ $? -ne 0 ]; then
   echo -e "${RED}Failed to set up microclimate. ${RESET}\n"
   exit 1
else
   echo -e "${GREEN}Successfully set up microclimate. ${RESET}\n"
fi

# Test microclimate
echo -e "${BLUE}Testing microclimate... ${RESET}"
$MC_NIGHTLY_RUN_DIR/test_microclimate.sh $DtestType $MC_INSTALL_ARCH $DoptionType $DEVELOPMENT_RUN
echo -e "${GREEN}Finished testing microclimate, test results reporting can be viewed here http://$HOSTNAME ${RESET}\n"

# Stop and uninstall microclimate
# Clean up current microclimate related containers and images
# Delete current microclimate related folders and files
echo -e "${BLUE}Cleaning up current microclimate... ${RESET}"
# Do not pass DoptionType(cache) argument here.
# Passing DtestType and DoptionType argument removes all docker images
# Passing only DtestType removes the non cache docker images
# We want cache availabe for next microclimate test run
$MC_NIGHTLY_RUN_DIR/uninstall_microclimate.sh $DtestType $MC_INSTALL_ARCH

if [ $? -ne 0 ]; then
   echo -e "${RED}Fail to clean up current microclimate. ${RESET}\n"
   exit 1
else
   echo -e "${GREEN}Successfully cleaned up current microclimate. ${RESET}\n"
fi

echo "Test results are showing in http://$HOSTNAME" 
