#!/bin/bash

# Colours for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

MC_DIR=~/tempest
TEST_DIR="$MC_DIR/src/pfe/file-watcher/server"
TEST_RESULTS=~/test_results
TEST_OUTPUT=test_output.xml
WEBSERVER_FILE="$MC_DIR/src/pfe/iterative-dev/test/microclimate-test/scripts/webserver.sh"

CODEWIND_REPO=git@github.ibm.com:dev-ex/tempest.git

DATE_NOW="$(date +"%d-%m-%Y")"
TIME_NOW="$(date +"%H.%M.%S")"

BRANCH=$1
TEST_BUCKET=$2
DEVELOPMENT_RUN=$3

BUCKET_NAME="file-watcher-pfe-$TEST_BUCKET"
TEST_LOGS="$TEST_BUCKET-test.log"
TEST_FOLDER="$TEST_RESULTS/$TEST_BUCKET/$DATE_NOW"

echo -e "${BLUE}>> Creating test directories...${RESET}"
mkdir -p $TEST_FOLDER
mkdir "$TEST_FOLDER/$TIME_NOW"
TEST_OUTPUT_DIR="$TEST_RESULTS/$TEST_BUCKET/$DATE_NOW/$TIME_NOW"
touch $TEST_OUTPUT_DIR/$TEST_OUTPUT
echo -e "${GREEN}>> Done.${RESET}"

echo -e "${BLUE}>> Removing old codewind install...${RESET}"
rm -rf $MC_DIR
if [ $? -ne 0 ]; then
    echo -e "${RED}>> Failed to remove old install.${RESET}"
    exit 1
else
    echo -e "${GREEN}>> Done.${RESET}"
fi

echo -e "${BLUE}>> Downloading new codewind...${RESET}"
git clone $CODEWIND_REPO -b $BRANCH
if [ $? -ne 0 ]; then
    echo -e "${RED}>> Failed to download codewind.${RESET}"
    exit 1
else
    echo -e "${GREEN}>> Done.${RESET}"
fi

echo -e "${BLUE}>> Run docker system prune...${RESET}"
docker system prune -af
if [ $? -ne 0 ]; then
    echo -e "${RED}>> Failed perform docker system prune.${RESET}"
    exit 1
else
    echo -e "${GREEN}>> Done.${RESET}"
fi

echo -e "${BLUE}>> Switch into MC directory...${RESET}"
cd $MC_DIR
if [ $? -ne 0 ]; then
    echo -e "${RED}>> Failed to switch to $MC_DIR.${RESET}"
    exit 1
else
    echo -e "${GREEN}>> Done.${RESET}"
fi

echo -e "${BLUE}>> Stopping old codewind...${RESET}"
./stop.sh
if [ $? -ne 0 ]; then
    echo -e "${RED}>> Failed to stop old codewind.${RESET}"
    exit 1
else
    echo -e "${GREEN}>> Done.${RESET}"
fi

echo -e "${BLUE}>> Installing codewind...${RESET}"
./run.sh
if [ $? -ne 0 ]; then
    echo -e "${RED}>> Failed to install codewind.${RESET}"
    exit 1
else
    echo -e "${GREEN}>> Done.${RESET}"
fi

echo -e "${BLUE}>> Switching to FW test directory...${RESET}"
cd $TEST_DIR
if [ $? -ne 0 ]; then
    echo -e "${RED}>> Failed to switch to $TEST_DIR.${RESET}"
    exit 1
else
    echo -e "${GREEN}>> Done.${RESET}"
fi

echo -e "${BLUE}>> Installing node modules...${RESET}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}>> Failed to install node modules.${RESET}"
    exit 1
else
    echo -e "${GREEN}>> Done.${RESET}"
fi

echo -e "${BLUE}>> Running $TEST_BUCKET test...${RESET}"
export JUNIT_REPORT_PATH=$TEST_OUTPUT_DIR/$TEST_OUTPUT
npm run $TEST_BUCKET:test:xml |& tee $TEST_OUTPUT_DIR/$TEST_LOGS
echo -e "${GREEN}>> Test logs available at: $TEST_OUTPUT_DIR/$TEST_LOGS ${RESET}"
echo -e "${GREEN}>> Done.${RESET}"

if [[ -z "$DEVELOPMENT_RUN" ]]; then
    echo -e "${BLUE}>> Making logs available online...${RESET}"
    $WEBSERVER_FILE $TEST_OUTPUT_DIR > /dev/null
    echo -e "${GREEN}>> Done.${RESET}"

    echo -e "${BLUE}>> Curling to test dashboard with the XML file...${RESET}"
    curl --header "Content-Type:text/xml" --data-binary @$TEST_OUTPUT_DIR/$TEST_OUTPUT --insecure "https://9.37.138.217/postxmlresult/$BUCKET_NAME/test" > /dev/null
    echo -e "${GREEN}>> Done.${RESET}"
fi
