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
TEST_PACKAGE=test-1.0.0.tgz
TESTXMLCOLLECTOR="https://9.37.138.217/postxmlresult"

#Colours
MAGENTA='\033[0;35m'
BLUE='\033[0;34m'
RED='\033[0;31m'
RESET='\033[0m'

# Check to see if $1 is empty (Used for GIT_AUTH)
if [ -z "$1" ]; then
  AUTH=$GIT_AUTH;
else
  AUTH=$1;
fi

if [ -z "$2"]; then
  EXPORT_AUTH=$GIT_EXPORT_AUTH;
else
  EXPORT_AUTH=$2;
fi

ARCH=`uname -m`;

printf "\n\n${MAGENTA}Platform: $ARCH ${RESET}\n"
# Run filewatcher tests if the scope is set accordingly, otherwise default to portal
if [ "$TEST_SCOPE" == "codewind-pfe-smoke-tests" ]; then
  printf "\n${MAGENTA}********** Running filewatcher test bucket 1 **********${RESET}\n\n"
  ./src/pfe/iterative-dev/test/microclimate-test/scripts/test_microclimate.sh local $ARCH
  exit $?;
elif [ "$TEST_SCOPE" == "filewatcher2" ]; then
  printf "\n${MAGENTA}********** Running filewatcher test bucket 2 **********${RESET}\n\n"
  ./src/pfe/iterative-dev/test/microclimate-test/scripts/test_microclimate.sh local $ARCH
  exit $?;
elif [ "$TEST_SCOPE" == "file-watcher-pfe-all" ]; then
  printf "\n${MAGENTA}********** Running file-watcher pfe unit test bucket **********${RESET}\n\n"
  ./src/pfe/file-watcher/server/test/cronjob-main.sh master unit
  if [ $? -ne 0 ]; then
    echo -e "${RED}>> Unit test failed. Will not run functional test.${RESET}"
    exit 1
  else
    printf "\n${MAGENTA}********** Running file-watcher pfe functional test bucket **********${RESET}\n\n"
    ./src/pfe/file-watcher/server/test/cronjob-main.sh master functional
    exit $?;
  fi
fi

# Run eslint
echo $PATH
cd src/pfe/portal
npm install
npm run eslint
if [ $? -ne 0 ]; then
    exit 1
fi
cd ../../..

# Tell PFE to start with code coverage enabled
export PFE_DEV_NODE_ENV=production # Don't install devDependencies for test
export PFE_CODE_COVERAGE=true # Run with nyc code coverage enabled

# Start Codewind
./run.sh;

# Build the tests and run them against the portal.
cd test/
npm install
npm run eslint
if [[ ! -z $TRAVIS_BUILD_NUMBER && $? -ne 0 ]]; then
  exit 1
fi

GIT_AUTH=$AUTH
GIT_EXPORT_AUTH=$EXPORT_AUTH
npm run test
rc=$?;
cd ..

# Combine the code coverage the unit and API tests
node ./test/scripts/generate_complete_coverage.js
if [ $? -ne 0 ]; then
    printf "\n\n${RED}Code Coverage could not be generated${RESET}\n\n"
fi

# Output portal logs
printf "\n${MAGENTA}********** codewind-pfe logs **********\n\n"
docker logs codewind-pfe > codewind-pfe-test-sh-output.log

printf "\n\n\nCodewind logs outputted to $PWD/codewind-pfe-test-sh-output.log\n"
printf "${RESET}"

# Shutdown and cleanup.
./stop.sh;

if [ -f test/test-results.xml ]; then
  # If not a PR build then send the results to the dashboard
  if [[ "$TRAVIS_EVENT_TYPE" == "cron" ]]; then
    echo "Sending results to test aggregator"
    # 'default' test results are x86_64, other split out by platform.
    if [[ "$ARCH" == 'x86_64' ]]; then
      TEST_NAME="$TEST_SCOPE";
    else
      TEST_NAME="$TEST_SCOPE-$ARCH";
    fi
    curl --insecure --header "Content-Type:text/xml" --data-binary @mtest/test-results.xml "${TESTXMLCOLLECTOR}/${TEST_NAME}/build${TRAVIS_BUILD_NUMBER}"
  fi
else
  echo "No test results file was found."
fi

exit $rc;
