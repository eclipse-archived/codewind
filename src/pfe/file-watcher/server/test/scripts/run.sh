#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

CW_DIR=~/codewind
CODEWIND_REPO=git@github.com:eclipse/codewind.git

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: [-<option letter> <options value> | -h]
Options:
    -t # Test type, currently support local and kube - Mandatory
    -b # Test branch
    -f # Function, currently support setup and cleanup - Mandatory
    -h # Display the man page
EOF
}

# Setup function does the following things
# 1 Download Codewind repository
# 2 Build Codewind images
# 3 Run Codewind containers
function setup {
    if [[ -z $TEST_BRANCH ]]; then
        TEST_BRANCH="master"
    fi
    git clone $CODEWIND_REPO -b $TEST_BRANCH
    && ./$CW_DIR/run.sh

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}Setup is failed. ${RESET}\n"
        exit 1
    fi
}

# Cleanup function does the following things
# 1 Remove Codewind and Codewind app containers
# 2 Remove Codewind and Codewind app images
# 3 Remove Codewind repository
function cleanup {
    ./$CW_DIR/stop.sh
    && rm -rf $CW_DIR

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}Cleanup is failed. ${RESET}\n"
        exit 1
    fi
}

while getopts "t:b:h" OPTION; do
    case "$OPTION" in
        t) 
            TEST_TYPE=$OPTARG
            # Check if test type argument is correct
            if [[ ($TEST_TYPE != "setup") && ($TEST_TYPE != "kube") ]]; then
                echo -e "${RED}Test type argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        b) 
            TEST_BRANCH=$OPTARG
            ;;
        f)
            RUN_FUNCTION=$OPTARG
            # Check if function argument is correct
            if [[ ($RUN_FUNCTION != "setup") && ($RUN_FUNCTION != "cleanup") ]]; then
                echo -e "${RED}Function argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        *)
            usage
            exit 0
            ;;
    esac
done

# Chekc if the mandatory arguments have been set up
if [[ (-z $TEST_TYPE) || (-z $RUN_FUNCTION) ]]; then
    echo -e "${RED}Mandatory arguments are not set up. ${RESET}\n"
    usage
    exit 1
fi

if [[ $RUN_FUNCTION == "setup" ]];then
    setup
elif [[ $RUN_FUNCTION == "cleanup" ]];then
    cleanup
fi

