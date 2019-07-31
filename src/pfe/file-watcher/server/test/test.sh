#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Set up default options value for test
TEST_TYPE="local"
TEST_SUITE="functional"
POST_CLEANUP="n"

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    -t # Test type, currently support 'local' and 'kube' - Optional
    -s # Test suite - Optional
    -p # Post cleanup, post test automation cleanup for cronjob, currently support 'y' and 'n' - Optional
    -c # Test configuration - currently support 'setup' for install and uninstall PFE container - Optional
    -h # Display the man page
EOF
}

function runWithoutSetup {
    # Run test cases
    ./scripts/exec.sh -t $TEST_TYPE -s $TEST_SUITE
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Run test cases is successful. ${RESET}\n"
    else
        echo -e "${RED}Run test cases is failed. ${RESET}\n"
        exit 1
    fi
}

function runWithSetup {
    # Pre test automation cleanup
    ./scripts/setup.sh -t $TEST_TYPE -f uninstall
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Pre test automation cleanup is successful. ${RESET}\n"
    else
        echo -e "${RED}Pre test automation cleanup is failed. ${RESET}\n"
        exit 1
    fi

    # Set up test automation
    ./scripts/setup.sh -t $TEST_TYPE -b $TEST_BRANCH -f install
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Set up test automation is successful. ${RESET}\n"
    else
        echo -e "${RED}Set up test automation is failed. ${RESET}\n"
        exit 1
    fi

    # Run test cases
    ./scripts/exec.sh -t $TEST_TYPE -s $TEST_SUITE
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Run test cases is successful. ${RESET}\n"
    else
        echo -e "${RED}Run test cases is failed. ${RESET}\n"
        exit 1
    fi

    # Post test automation cleanup
    # Cronjob machines need to set up POST_CLEANUP=y to do post test automation cleanup
    if [[ $POST_CLEANUP == "y" ]]; then
        ./setup.sh -t $TEST_TYPE -f uninstall
        if [[ $? -eq 0 ]]; then
            echo -e "${GREEN}Post test automation cleanup is successful. ${RESET}\n"
        else
            echo -e "${RED}Post test automation cleanup is failed. ${RESET}\n"
            exit 1
        fi
    fi
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

if [[ (-z $TEST_CONFIGURATION) ]]; then
    runWithoutSetup
else
    runWithSetup
fi
