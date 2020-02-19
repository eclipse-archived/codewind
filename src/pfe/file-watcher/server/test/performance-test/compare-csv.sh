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

BASELINE_FILE=
COMPARABLE_FILE=
ERROR_THRESHOLD=5
SAVE_FILE="n"
SAVE_FILEPATH=
PYTHON_CHECK="y"

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    --baseline-file     The baseline csv file. Required
    --comparable-file   The comparable csv file. Required
    --error-threshold   The minimum amount of error level threshold. Default: 5%      
    --save              Save report to a text file path. Default: n
    --check-python      Perform a check to see if python is setup. Default: y
    -h | --help         Display the man page
EOF
}

while :; do
    case $1 in
        --baseline-file=?*)
        BASELINE_FILE=${1#*=}
        ;;
        --comparable-file=?*)
        COMPARABLE_FILE=${1#*=}
        ;;
        --error-threshold=?*)
        ERROR_THRESHOLD=${1#*=}
        ;;
        --save=?*)
        SAVE_FILE="y"
        SAVE_FILEPATH=${1#*=}
        ;;
        --check-python=?*)
        PYTHON_CHECK=${1#*=}
        ;;
        -h|--help)
        usage
        exit
        ;;
        *) break
    esac
    shift
done

if [ -z "$BASELINE_FILE" ] || [ -z "$COMPARABLE_FILE" ]; then
    checkExitCode 1 "Both arguments for file comparison is required. For more info check: ./compare-csv.sh --help" true
fi

echo -e "${CYAN}> Checking if baseline file "$BASELINE_FILE" exist on local disk ${RESET}"
if [ ! -e "$BASELINE_FILE" ]; then
    checkExitCode 1 "File "$BASELINE_FILE" not found." true
fi

echo -e "${CYAN}> Checking if comparable file "$COMPARABLE_FILE" exist on local disk ${RESET}"
if [ ! -e "$COMPARABLE_FILE" ]; then
    checkExitCode 1 "File "$COMPARABLE_FILE" not found." true
fi

if [[ $PYTHON_CHECK == "n" ]]; then
    echo -e "${CYAN}> Checking for virtualenv ${RESET}"
    virtualenv --version > /dev/null 2>&1
    checkExitCode $? "Missing virtualenv command. Please install and try again." true

    echo -e "${CYAN}> Checking for python ${RESET}"
    python --version > /dev/null 2>&1
    checkExitCode $? "Missing python command. Please install and try again." true

    echo -e "${CYAN}> Checking for pip ${RESET}"
    pip > /dev/null 2>&1
    checkExitCode $? "Missing pip command. Please install and try again." true

fi

echo -e "${CYAN}> Creating python virtual environment ${RESET}"
virtualenv venv -p $(which python) > /dev/null 2>&1
checkExitCode $? "Failed to create up python virtual environment. Please try again." true

echo -e "${CYAN}> Activating python virtual environment ${RESET}"
source venv/bin/activate > /dev/null 2>&1
checkExitCode $? "Failed to activate up python virtual environment. Please try again." true

echo -e "${CYAN}> Installing required python dependencies: pandas ${RESET}"
pip install pandas > /dev/null 2>&1
checkExitCode $? "Failed to install pandas module. Please try again." true

if [ $SAVE_FILE == "y" ] && [ ! -z "$SAVE_FILEPATH" ]; then
    echo -e "${CYAN}> Running csv comparable script and saving output to "$SAVE_FILEPATH" ${RESET}"
    python compare-csv.py "$BASELINE_FILE" "$COMPARABLE_FILE" $ERROR_THRESHOLD | tee "$SAVE_FILEPATH"
else
    echo -e "${CYAN}> Running csv comparable script ${RESET}"
    python compare-csv.py "$BASELINE_FILE" "$COMPARABLE_FILE" $ERROR_THRESHOLD
fi
checkExitCode $? "Failed to run python script."

echo -e "${CYAN}> Deactivating python virtual environment ${RESET}"
deactivate venv > /dev/null 2>&1
checkExitCode $? "Failed to deactivate up python virtual environment. Please try again." true
