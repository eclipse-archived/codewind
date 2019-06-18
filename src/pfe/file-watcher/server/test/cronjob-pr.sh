#!/bin/bash

# Colours for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

TEST_BUCKET=$1

if [[ -n $TRAVIS_PULL_REQUEST ]]; then
    echo -e "\n${BLUE}This is a Travis Pull Request build${RESET}"
    MC_DIR=$PWD
    TEST_DIR="$MC_DIR/src/pfe/file-watcher/server"

    echo -e "${BLUE}>> Installing Tempest...${RESET}"
    $MC_DIR/run.sh
    if [ $? -ne 0 ]; then
      echo -e "${RED}>> Failed to install tempest.${RESET}"
      exit 1
    else
        echo -e "${GREEN}>> Done.${RESET}"
    fi

    echo -e "${BLUE}>> Switching to FW test directory...${RESET}"
    cd $TEST_DIR
    if [ $? -ne 0 ]; then
      echo -e "${RED}>> Failed to switch directory.${RESET}"
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
    npm run $TEST_BUCKET:test
    if [ $? -ne 0 ]; then
      echo -e "${RED}>> Test failed.${RESET}"
      exit 1
    else
        echo -e "${GREEN}>> Done.${RESET}"
    fi
fi
