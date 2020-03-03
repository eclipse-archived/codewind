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

#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Set up variables
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
INITIAL_DIR=$(pwd)

source $DIR/utils.sh
cd $INITIAL_DIR

# Set up default options value for test
TEST_TYPE="local"
TEST_SUITE="functional"
POST_CLEANUP="n"
CLEAN_RUN="n"
CLEAN_WORKSPACE="n"
CWCTL_PROJ="y"

while getopts "t:s:p:c:d:o:h" OPTION; do
    case "$OPTION" in
        t) 
            export TEST_TYPE=$OPTARG
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

function cleanRun {
    if [[ ($CWCTL_PROJ == "y" && $TEST_TYPE == "kube") || ($CWCTL_PROJ == "n") ]]; then
        # Pre-test cleanup
        ./scripts/setup.sh -t $TEST_TYPE -f uninstall
        if [[ $? -eq 0 ]]; then
            echo -e "${GREEN}Pre-test cleanup was successful. ${RESET}\n"
        else
            echo -e "${RED}Pre-test cleanup failed. ${RESET}\n"
            exit 1
        fi

        # Sleep for a few secs for Pods and PVs to free up
        echo -e "${BLUE}Sleeping for 20s to allow the workspace removal to take down Pods and PVs ${RESET}\n"
        sleep 20

        # Set up test automation
        ./scripts/setup.sh -t $TEST_TYPE -f install
        if [[ $? -eq 0 ]]; then
            echo -e "${GREEN}Test automation setup was successful. ${RESET}\n"
        else
            echo -e "${RED}Test automation setup failed. ${RESET}\n"
            exit 1
        fi
    fi

    # Execute the tests
    executeTests
}

function postClean {
    ./scripts/setup.sh -t $TEST_TYPE -f uninstall
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Post-test cleanup was successful. ${RESET}\n"
    else
        echo -e "${RED}Post-test cleanup failed. ${RESET}\n"
        exit 1
    fi
}

function executeTests {
    # Run test cases
    ./scripts/exec.sh -t $TEST_TYPE -s $TEST_SUITE -d $CLEAN_WORKSPACE
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}\nFinished running tests. ${RESET}\n"
    else
        echo -e "${RED}\nThe test run has failed. ${RESET}\n"
        exit 1
    fi
}

# Log in to the OKD cluster with default credentials
if [[ $TEST_TYPE == "kube" ]]; then
    if [ $TEST_SUITE == "unit" ]; then
        echo -e "${RED}Turbine Unit tests are not designed to run on a Kube environment, please switch to Local. ${RESET}\n"
        exit 1
    fi

    CHECK_EX=0

    # Check if the mandatory arguments have been set up
    if [[ (-z $NAMESPACE) ]]; then
        echo -e "${RED}Mandatory argument NAMESPACE is not set up. ${RESET}\n"
        echo -e "${RED}Please export variable NAMESPACE to run the Kube tests. ${RESET}\n"
        CHECK_EX=1
    fi

    if [[ (-z $CLUSTER_IP) ]]; then
        echo -e "${RED}Mandatory argument CLUSTER_IP is not set up. ${RESET}\n"
        echo -e "${RED}Please export variable CLUSTER_IP to run the Kube tests. ${RESET}\n"
        CHECK_EX=1
    fi

    if [[ (-z $CLUSTER_PORT) ]]; then
        echo -e "${RED}Mandatory argument CLUSTER_PORT is not set up. ${RESET}\n"
        echo -e "${RED}Please export variable CLUSTER_PORT to run the Kube tests. ${RESET}\n"
        CHECK_EX=1
    fi

    if [[ (-z $CLUSTER_USER) ]]; then
        echo -e "${RED}Mandatory argument CLUSTER_USER is not set up. ${RESET}\n"
        echo -e "${RED}Please export variable CLUSTER_USER to run the Kube tests. ${RESET}\n"
        CHECK_EX=1
    fi

    if [[ (-z $CLUSTER_PASSWORD) ]]; then
        echo -e "${RED}Mandatory argument CLUSTER_PASSWORD is not set up. ${RESET}\n"
        echo -e "${RED}Please export variable CLUSTER_PASSWORD to run the Kube tests. ${RESET}\n"
        CHECK_EX=1
    fi

    if [[ $CHECK_EX -eq 1 ]]; then
        exit 1
    fi

    oc login $CLUSTER_IP:$CLUSTER_PORT -u $CLUSTER_USER -p $CLUSTER_PASSWORD --insecure-skip-tls-verify=true
    oc project $NAMESPACE
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Successfully logged into the OKD cluster ${RESET}\n"
    else
        echo -e "${RED}Failed to log into the OKD cluster ${RESET}\n"
        exit 1
    fi
fi

if [[ $TEST_SUITE == "functional" && $CLEAN_RUN == "y" ]]; then
    cleanRun
else
    executeTests
fi

if [[ $POST_CLEANUP == "y" ]]; then
    # Post-test cleanup
    # Cronjob machines need to set up POST_CLEANUP=y to do post-test automation cleanup
    postClean
fi
