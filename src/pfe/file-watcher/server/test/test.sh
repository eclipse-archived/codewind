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
CLEAN_RUN="n"
CLEAN_WORKSPACE="n"

# Set up variables
cd ../../../../../
CW_DIR=$(pwd)
cd -

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    -t # Test type, currently supports 'local' or 'kube' - Optional
    -s # Test suite, currently supports 'functional' - Optional
    -p # Post cleanup, post test cleanup for cronjob, currently supports 'y' or 'n' - Optional
    -c # Clean run - currently supports y' or 'n' - Optional
    -d # Clean workspace - currently supports y' or 'n' - Optional
    -h # Display the man page
EOF
}

function run {
    # Need to ensure Codewind container is up and running before running test cases
    # Need to run 'run.sh' in Codewind home directory because 'run.sh' uses relative path to run other building scripts
    cd $CW_DIR
    ./run.sh
    cd -

    # Run test cases
    ./scripts/exec.sh -t $TEST_TYPE -s $TEST_SUITE -d $CLEAN_WORKSPACE
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}\nFinished running tests. ${RESET}\n"
    else
        echo -e "${RED}\nThe test run has failed. ${RESET}\n"
        exit 1
    fi
}

function cleanRun {
    # Pre-test cleanup
    ./scripts/setup.sh -t $TEST_TYPE -f uninstall
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Pre-test cleanup was successful. ${RESET}\n"
    else
        echo -e "${RED}Pre-test cleanup failed. ${RESET}\n"
        exit 1
    fi

    # Set up test automation
    ./scripts/setup.sh -t $TEST_TYPE -f install
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Test automation setup was successful. ${RESET}\n"
    else
        echo -e "${RED}Test automation setup failed. ${RESET}\n"
        exit 1
    fi

    # Run test cases
    ./scripts/exec.sh -t $TEST_TYPE -s $TEST_SUITE -d $CLEAN_WORKSPACE
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}\nFinished running tests. ${RESET}\n"
    else
        echo -e "${RED}\nThe test run has failed. ${RESET}\n"
        exit 1
    fi

    # Post-test cleanup
    # Cronjob machines need to set up POST_CLEANUP=y to do post-test automation cleanup
    if [[ $POST_CLEANUP == "y" ]]; then
        ./scripts/setup.sh -t $TEST_TYPE -f uninstall
        if [[ $? -eq 0 ]]; then
            echo -e "${GREEN}Post-test cleanup was successful. ${RESET}\n"
        else
            echo -e "${RED}Post-test cleanup failed. ${RESET}\n"
            exit 1
        fi
    fi
}

while getopts "t:s:p:c:d:h" OPTION; do
    case "$OPTION" in
        t) 
            TEST_TYPE=$OPTARG
            # Check if test type argument is correct
            if [[ ($TEST_TYPE != "local") && ($TEST_TYPE != "kube") ]]; then
                echo -e "${RED}Test type argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        s) 
            TEST_SUITE=$OPTARG
            # Check if test suite argument is corrent
            if [[ ($TEST_SUITE != "functional") ]]; then
                echo -e "${RED}Test suite argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        p)
            POST_CLEANUP=$OPTARG
            # Check if post cleanup argument is correct
            if [[ ($POST_CLEANUP != "y") && ($POST_CLEANUP != "n") ]]; then
                echo -e "${RED}Post cleanup argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        c) 
            CLEAN_RUN=$OPTARG
            # Check if clean run argument is correct
            if [[ ($CLEAN_RUN != "y") && ($CLEAN_RUN != "n") ]]; then
                echo -e "${RED}Clean run argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        d)
            CLEAN_WORKSPACE=$OPTARG
            # Check if clean workspace argument is correct
            if [[ ($CLEAN_WORKSPACE != "y") && ($CLEAN_WORKSPACE != "n") ]]; then
                echo -e "${RED}Clean workspace argument is not correct. ${RESET}\n"
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

if [[ ($CLEAN_RUN == "y") ]]; then
    cleanRun
else
    run
fi
