#!/bin/bash

# Colours for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

echo -e "\n${BLUE}---------------------------${RESET}"
echo -e "${BLUE}  filewatcher test script  ${RESET}"
echo -e "${BLUE}---------------------------${RESET}"

# Test for Windows Host OS
isMicroclimateRunningOnWindows() {
   [[ $(uname -r) =~ Microsoft$ ]]
}

if [[ -n $TRAVIS_PULL_REQUEST ]]; then
   echo -e "\n${BLUE}This is a Travis Pull Request build${RESET}"
   MC_DIR=$PWD
   WORKSPACE_PROP=-Dmicroclimate.workspace=$MC_DIR/codewind-workspace
   OUTPUT_DIR=~/microclimate_results
   # Start microclimate.
   $MC_DIR/run.sh;
   if [ $? -ne 0 ]; then
      exit 1
   fi
elif isMicroclimateRunningOnWindows; then
   MC_DIR=/c/tempest
   OUTPUT_DIR=/c/microclimate_results
else
   MC_DIR=~/tempest
   OUTPUT_DIR=~/microclimate_results
fi

TEST_DIR=$MC_DIR/src/pfe/iterative-dev/test/microclimate-test
ITERATIVEDEV_DIR=$MC_DIR/src/pfe/iterative-dev
MC_NIGHTLY_RUN_DIR=$MC_DIR/src/pfe/iterative-dev/test/microclimate-test/scripts
DtestType=$1
MC_INSTALL_ARCH=$2
DoptionType=$3
DEVELOPMENT_RUN=$4
hostname=$(hostname -f)

echo "MC_DIR is set to $MC_DIR"

# Install log4js module since get_cookie.js needs it
echo -e "${BLUE}Installing node package log4js for get_cookie script ... ${RESET}"
npm install --prefix $MC_DIR log4js

# Check arguments
echo -e "${BLUE}Checking arguments... ${RESET}"

if [[ ! $# -gt 1 || ! $# -lt 4 ]]; then
    echo -e "${RED}Wrong Arguments. Please enter:${RESET}"
    echo "Options for Argument 1:"
    echo "local"
    echo "   - test microclimate locally"
    echo "icp"
    echo "   - test microclimate in ICP"
    echo "Options for Argument 2:"
    echo "x86_64"
    echo "   - test microclimate on x86_64"
    echo "ppc64le"
    echo "   - test microclimate on ppc64le"
    echo "Options for Argument 3 (Optional):"
    echo "cache"
    echo "   - create test cache"
    exit 1
fi

# Check if the first argument is correct
if [[ ($1 != "local" && $1 != "icp") ]]; then
   echo -e "${RED}First Argument is not correct, please input from the following: ${RESET}"
   echo "Options:"
   echo "local"
   echo "   - Test microclimate locally"
   echo "icp"
   echo "   - Test microclimate in ICP"
   exit 1
else
   echo -e "${GREEN}First Argument is correct. ${RESET}\n"
fi

# Check if the second argument is correct
if [[ ($2 != "x86_64" && $2 != "ppc64le") ]]; then
   echo -e "${RED}Second argument is not correct, please enter from the following: ${RESET}"
   echo "Options:"
   echo "x86_64"
   echo "   - test microclimate on x86_64"
   echo "ppc64le"
   echo "   - test microclimate on ppc64le"
   exit 1
else
   echo -e "${GREEN}Second Argument is correct. ${RESET}\n"
fi

# Check if the third argument is present, which is optional
if [[ $3 && $3 == "cache" ]]; then
   echo -e "${GREEN}Third Argument is correct. Cache option has been selected. ${RESET}\n"
   echo -e "${GREEN}Microclimate will create Application cache images only. ${RESET}\n"
elif [[ $3 && $3 == "quarantine" ]]; then
   echo -e "${GREEN}Third Argument is correct. Quarantine option has been selected. ${RESET}\n"
   echo -e "${GREEN}The Quarantine Suite will be executed. ${RESET}\n"
elif [[ $3 && $3 != "cache" ]] || [[ $3 && $3 != "quarantine" ]]; then
   echo -e "${RED}Third Argument is not correct. At this moment, file watcher test only supports the cache and the quarantine option. Exiting... ${RESET}\n"
   exit 1
fi

# Check if PROXY_IP is set for ICP on the test host machine
if [[ $DtestType == "icp" && -z $PROXY_IP ]]; then
   echo -e "${RED}PROXY_IP env var not set. ${RESET}\n"
   exit 1
fi

# Since filewatcher has the limitation of building projects under codewind-workspace directory
# Need to copy all existing projects to codewind-workspace directory for testing
# Once filewatcher resolves the limitation, the following code of copying existing projects can be removed
CODEWIND_WORKSPACE=$MC_DIR/codewind-workspace
PROJECTS_RESOURCES_DIR=$TEST_DIR/resources
echo -e "${BLUE}Copying all existing projects to codewind-workspace directory. ${RESET}"
cp -r $PROJECTS_RESOURCES_DIR/* $CODEWIND_WORKSPACE
if [ $? -eq 0 ]; then
   echo -e "${GREEN}Successfully copied all existing projects to codewind-workspace directory. ${RESET}\n"
else
   echo -e "${RED}Failed to copy all existing projects to codewind-workspace directory. ${RESET}\n"
   exit 1
fi


# Go into iterative-dev directory
cd $ITERATIVEDEV_DIR

# Run mvn package to package IDC.jar to iterative-dev/test/artifacts
mvn package
if [ $? -ne 0 ]; then
    exit 1
fi

# Go into the test directory
cd $TEST_DIR

# Clean, then build+run the tests
mvn clean
if [ $? -ne 0 ]; then
    exit 1
fi

# Specify non-default workspace dir and other flags if Microclimate is running on Windows
if isMicroclimateRunningOnWindows; then
   WINFLAGS=("-DisMicroclimateRunningOnWindows=true" "-DretryCount=1")
   WORKSPACE_PROP=-Dmicroclimate.workspace=/c/microclimate-release/codewind-workspace
fi

if [[ $DoptionType && $DoptionType == "cache" ]]; then
   echo -e "${GREEN}Running the cache suite. ${RESET}\n"
   if [ $DtestType == "local" ]; then
      echo -e "${GREEN}Running the cache suite for local. ${RESET}\n"
      mvn site -Dtest="**/AllCache.java" -DtestType="$DtestType" -DportalAPIVersion="v1" ${WINFLAGS[@]} $WORKSPACE_PROP
   fi
elif [[ $DoptionType && $DoptionType == "quarantine" ]]; then
   echo -e "${GREEN}Running the quarantine suite. ${RESET}\n"
   if [ $DtestType == "local" ]; then
      mvn site -Dtest="**/AllQuarantineTests.java" -DtestType="$DtestType" -DportalAPIVersion="v1"
   elif [ $DtestType == "icp" ]; then
      COOKIE=`node $MC_NIGHTLY_RUN_DIR/get_cookie.js https://microclimate.$PROXY_IP.nip.io/ admin admin`
      mvn site -Dtest="**/AllQuarantineTests.java" -DtestType="$DtestType" -Dcookie="$COOKIE" -DportalAPIVersion="v1"
   fi
else
   if [ $DtestType == "local" ]; then
      # Determine test bucket to run, TEST_SCOPE is an environment variable set by PR builds
      if [[ "$TEST_SCOPE" == "codewind-pfe-smoke-tests" ]]; then
         TEST_BUCKET="ImportFromFolder"
      elif [[ "$TEST_SCOPE" == "filewatcher2" ]]; then
         TEST_BUCKET="APITests2"
      else
         if [ $MC_INSTALL_ARCH == "x86_64" ]; then
            TEST_BUCKET="AllTests"
         elif [ $MC_INSTALL_ARCH == "ppc64le" ]; then
            TEST_BUCKET="AllTestsPPC64LE"
         fi
      fi

      echo -e "${GREEN}Begin running the $TEST_BUCKET test suite. ${RESET}\n"
      mvn test -Dtest="**/$TEST_BUCKET.java" -DtestType="$DtestType" -DportalAPIVersion="v1" ${WINFLAGS[@]} $WORKSPACE_PROP
      testExitCode=$?

      # Generate the results report site
      mvn site -DskipTests
   elif [ $DtestType == "icp" ]; then
      COOKIE=`node $MC_NIGHTLY_RUN_DIR/get_cookie.js https://microclimate.$PROXY_IP.nip.io/ admin admin`
      echo -e "${GREEN}Running the AllTestsIcp suite. ${RESET}\n"
      if [ $MC_INSTALL_ARCH == "x86_64" ]; then
         mvn test -Dtest="**/AllTestsIcp.java" -DtestType="$DtestType" -Dcookie="$COOKIE" -DportalAPIVersion="v1"
         testExitCode=$?
      elif [ $MC_INSTALL_ARCH == "ppc64le" ]; then
         mvn test -Dtest="**/AllTestsIcpPPC64LE.java" -DtestType="$DtestType" -Dcookie="$COOKIE" -DportalAPIVersion="v1"
         testExitCode=$?
      fi
      # Generate the results report site
      mvn site -DskipTests
   fi
fi

if [[ -z "$DEVELOPMENT_RUN" ]]; then
   # Upload local test result to dashboard (for now, don't do this for local Windows tests)
   if [ $hostname = "mc-test-local-linux-02.rtp.raleigh.ibm.com" ]; then
      # Local Linux Test Automation
      if [ -f $TEST_DIR/target/surefire-reports/TEST-org.eclipse.codewind.microclimate.test.AllTests.xml ]; then
         echo -e "${GREEN}Curling to test dashboard with the XML file ${RESET}\n"
         curl --header "Content-Type:text/xml" --data-binary @$TEST_DIR/target/surefire-reports/TEST-org.eclipse.codewind.microclimate.test.AllTests.xml --insecure "https://9.37.138.217/postxmlresult/file-watcher/test"
      else
         echo -e "${RED}Cannot curl to test dashboard as file is not present ${RESET}\n"
      fi
   elif [ $hostname = "mc-test-icp-linux-02.rtp.raleigh.ibm.com" ]; then
      # ICP Linux Test Automation
      if [ -f $TEST_DIR/target/surefire-reports/TEST-org.eclipse.codewind.microclimate.test.AllTestsIcp.xml ]; then
         echo -e "${GREEN}Curling to test dashboard with the XML file ${RESET}\n"
         curl --header "Content-Type:text/xml" --data-binary @$TEST_DIR/target/surefire-reports/TEST-org.eclipse.codewind.microclimate.test.AllTestsIcp.xml --insecure "https://9.37.138.217/postxmlresult/file-watcher-icp/test"
      else
         echo -e "${RED}Cannot curl to test dashboard as file is not present ${RESET}\n"
      fi
   elif [ $hostname = "p-linux-ubuntu-01.rtp.raleigh.ibm.com" ]; then
      # Local P Linux Test Automation
      if [ -f $TEST_DIR/target/surefire-reports/TEST-org.eclipse.codewind.microclimate.test.AllTestsPPC64LE.xml ]; then
         echo -e "${GREEN}Curling to test dashboard with the XML file ${RESET}\n"
         curl --header "Content-Type:text/xml" --data-binary @$TEST_DIR/target/surefire-reports/TEST-org.eclipse.codewind.microclimate.test.AllTestsPPC64LE.xml --insecure "https://9.37.138.217/postxmlresult/file-watcher-ppc64le/test"
      else
         echo -e "${RED}Cannot curl to test dashboard as file is not present ${RESET}\n"
      fi
   elif [ $hostname = "p-linux-ubuntu-02.rtp.raleigh.ibm.com" ]; then
      # ICP P Linux Test Automation
      if [ -f $TEST_DIR/target/surefire-reports/TEST-org.eclipse.codewind.microclimate.test.AllTestsIcpPPC64LE.xml ]; then
         echo -e "${GREEN}Curling to test dashboard with the XML file ${RESET}\n"
         curl --header "Content-Type:text/xml" --data-binary @$TEST_DIR/target/surefire-reports/TEST-org.eclipse.codewind.microclimate.test.AllTestsIcpPPC64LE.xml --insecure "https://9.37.138.217/postxmlresult/file-watcher-icp-ppc64le/test"
      else
         echo -e "${RED}Cannot curl to test dashboard as file is not present ${RESET}\n"
      fi
   fi
fi


# Create a new directory on the machine containing today's date
OUTPUT_DIR_DATE=$OUTPUT_DIR/`date +%F-%H-%M-%S`
mkdir -p $OUTPUT_DIR_DATE

# Save the file-watcher log & view them on the browser
echo -e "${BLUE}Saving file-watcher log... ${RESET}"
if [ $DtestType == "local" ]; then
   echo -e "${GREEN}Redirecting docker container log ${RESET}\n"
   docker logs -f microclimate-file-watcher &> $TEST_DIR/target/site/filewatcher.log &
   docker logs -f microclimate-portal &> $TEST_DIR/target/site/portal.log &
elif [ $DtestType == "icp" ]; then
   echo -e "${GREEN}Redirecting k8s pod container log ${RESET}\n"
   FW_POD=$(kubectl get pod -n default | grep microclimate-admin-filewatcher | awk '{print $1}')
   echo -e "${GREEN}File-watcher pod is ${RESET}" $FW_POD
   kubectl logs -f $FW_POD &> $TEST_DIR/target/site/filewatcher.log &
   PORTAL_POD=$(kubectl get pod -l app=test-microclimate-ibm-microclimate-portal | awk '{print $1}' | awk 'FNR == 2 {print}')
   echo -e "${GREEN}Portal pod is ${RESET}" $PORTAL_POD
   kubectl logs -f $PORTAL_POD &> $TEST_DIR/target/site/portal.log &
fi

echo -e "${BLUE}Sleep for 60s so that file-watcher container log can be written to file locally for upload ${RESET}"
sleep 60

# Copy the HTML report into the new directory
cp -R $TEST_DIR/target/site/* $OUTPUT_DIR_DATE
cp -R $TEST_DIR/target/surefire-reports/* $OUTPUT_DIR_DATE

if [[ -n $TRAVIS_PULL_REQUEST ]]; then
    OUTPUT_DIR=~/microclimate_results
    # Stop microclimate.
    $MC_DIR/stop.sh;
else
    # Run script to setup web server for showing test results on web browser
    $TEST_DIR/scripts/webserver.sh $OUTPUT_DIR_DATE
fi

# use the exit code from the tests
exit $testExitCode
