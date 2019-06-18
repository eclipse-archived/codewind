#!/bin/bash

MC_DIR=~/microclimate
TEST_DIR=$MC_DIR/src/pfe/iterative-dev/test/idc-test
ITERATIVEDEV_DIR=$MC_DIR/src/pfe/iterative-dev
OUTPUT_DIR=~/idc_results

# Colours for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Go into iterative-dev directory
cd $ITERATIVEDEV_DIR

# Run mvn package to package IDC.jar to iterative-dev/test/artifacts
mvn package

# Go into the test directory
cd $TEST_DIR

# Clean, then build+run the tests
mvn clean site

# Create a new directory on the machine containing today's date
OUTPUT_DIR_DATE=$OUTPUT_DIR/`date +%F-%H-%M-%S`
mkdir -p $OUTPUT_DIR_DATE

# Copy the HTML report into the new directory
cp -R $TEST_DIR/target/site/* $OUTPUT_DIR_DATE

# Run script to setup web server for showing test results on web browser
$ITERATIVEDEV_DIR/test/microclimate-test/scripts/webserver.sh $OUTPUT_DIR_DATE
