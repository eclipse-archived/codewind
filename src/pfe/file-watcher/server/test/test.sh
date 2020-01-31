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
CWCTL_PROJ="y"

# Set up variables
source ./scripts/utils.sh

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    -o # Deploy PFE and create projects on local disk - 'y' or 'n' - Default: 'y'
    -t # Test type, currently supports 'local' or 'kube' - Optional
    -s # Test suite, currently supports 'functional' - Optional
    -p # Post cleanup, post test cleanup for cronjob, currently supports 'y' or 'n' - Optional
    -c # Clean run - currently supports y' or 'n' - Optional
    -d # Clean workspace - currently supports y' or 'n' - Optional
    -h # Display the man page
EOF
}

while getopts "t:s:p:c:d:o:h" OPTION; do
    case "$OPTION" in
        t) 
            TEST_TYPE=$OPTARG
            # Check if test type argument is correct
            if [[ ($TEST_TYPE != "local") && ($TEST_TYPE != "kube") && ($TEST_TYPE != "both") ]]; then
                echo -e "${RED}Test type argument is not correct. ${RESET}\n"
                usage
                exit 1
            fi
            ;;
        s) 
            TEST_SUITE=$OPTARG
            # Check if test suite argument is corrent
            if [[ ($TEST_SUITE != "functional") && ($TEST_SUITE != "unit") ]]; then
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
        o)
            CWCTL_PROJ=$OPTARG
            # Check if clean workspace argument is correct
            if [[ ($CWCTL_PROJ != "y") && ($CWCTL_PROJ != "n") ]]; then
                echo -e "${RED}Create projects with cwctl argument is not correct. ${RESET}\n"
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

if [[ $CWCTL_PROJ == "y" ]]; then
    ./scripts/create-project.sh
    checkExitCode $? "Failed to create projects."
fi

if [[ ($TEST_TYPE == "both") ]]; then
    ./scripts/runner.sh -t "local" -s $TEST_SUITE -p $POST_CLEANUP -c $CLEAN_RUN -o $CWCTL_PROJ > ~/turbine_local.log & \
    echo -e "${BLUE}Triggered local $TEST_SUITE suite as cronjob. ${RESET}\n"

    ./scripts/runner.sh -t "kube" -s $TEST_SUITE -p $POST_CLEANUP -c $CLEAN_RUN -o $CWCTL_PROJ > ~/turbine_kube.log & \
    echo -e "${BLUE}Triggered kube $TEST_SUITE suite as cronjob. ${RESET}\n"
else
    ./scripts/runner.sh -t $TEST_TYPE -s $TEST_SUITE -p $POST_CLEANUP -c $CLEAN_RUN -o $CWCTL_PROJ
fi
