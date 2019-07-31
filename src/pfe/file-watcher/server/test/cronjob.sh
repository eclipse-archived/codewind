#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Set up variables
CW_DIR=~/codewind
CW_TEST_DIR=$CW_DIR/src/pfe/file-watcher/server/test
CODEWIND_REPO=git@github.com:eclipse/codewind.git

# Make all options mandatory to ensure cronjob admin knows what exectly each cronjob does, it's for debug purpose
function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    -t # Test type, currently support 'local' and 'kube' - Mandatory
    -s # Test suite - Mandatory
    -p # Post cleanup, post test automation cleanup for cronjob, currently support 'y' and 'n' - Mandatory
    -c # Test configuration - currently support 'setup' for install and uninstall PFE container - Mandatory
    -h # Display the man page
EOF
}

while getopts "t:s:p:c:h" OPTION; do
    case "$OPTION" in
        t) 
            TEST_TYPE=$OPTARG
            # Check if test type argument is corrent
            if [[ ($TEST_TYPE != "local") && ($TEST_TYPE != "kube") ]]; then
                echo -e "${RED}Test type argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        s) 
            TEST_SUITE=$OPTARG
            ;;
        p)
            POST_CLEANUP=$OPTARG
            # Check if post cleanup argument is corrent
            if [[ ($POST_CLEANUP != "y") && ($POST_CLEANUP != "n") ]]; then
                echo -e "${RED}Post cleanup argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        c) 
            TEST_CONFIGURATION=$OPTARG
            # Check if test configuration argument is corrent
            if [[ ($TEST_CONFIGURATION != "setup") ]]; then
                echo -e "${RED}Test configuration argument is not correct. ${RESET}\n"
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
if [[ (-z $TEST_TYPE) || (-z $TEST_SUITE) || (-z $POST_CLEANUP) || (-z $TEST_CONFIGURATION) ]]; then
    echo -e "${RED}Mandatory arguments are not set up. ${RESET}\n"
    usage
    exit 1
fi

rm -rf $CW_DIR \
&& git clone $CODEWIND_REPO -b $TEST_BRANCH \
&& cd $CW_TEST_DIR
&& ./test.sh -t $TEST_TYPE -s $TEST_SUITE -p $POST_CLEANUP -c $TEST_CONFIGURATION \
&& rm -rf $CW_DIR

if [[ $? -ne 0 ]]; then
    echo -e "${RED}Cronjob is failed. ${RESET}\n"
    exit 1
fi

