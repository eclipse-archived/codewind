#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
INITIAL_DIR=$(pwd)

cd $DIR
cd ../../../../../../

CW_DIR=$(pwd)
cd $INITIAL_DIR

export PROJECTS_CLONE_DATA_FILE="$CW_DIR/src/pfe/file-watcher/server/test/resources/projects-clone-data"
export PROJECT_DIR="$CW_DIR/src/pfe/file-watcher/server/test/projects"
export TEST_INFO_DIR="$HOME/.codewindtest/turbine"

# Function to get the che and keycloak endpoint
function getEndpoints() {
    echo -e "${BLUE}Getting che endpoints${RESET}\n"

    CHE_ENDPOINT=$(kubectl get routes --selector=component=che -o jsonpath="{.items[0].spec.host}" 2>&1)
    KEYCLOAK_HOSTNAME=$(kubectl get routes --selector=component=keycloak -o jsonpath="{.items[0].spec.host}" 2>&1)
    TOKEN_ENDPOINT="http://${KEYCLOAK_HOSTNAME}/auth/realms/che/protocol/openid-connect/token"
}

# Function to generate the Che Access Token for Che User Authentication
function generateCheAccessToken {
    echo -e "${BLUE}Generating the Che Access Token ${RESET}\n"
    CHE_USER="admin"
    CHE_PASS="admin"

    getEndpoints

    CHE_ACCESS_TOKEN=$(curl -sSL --data "grant_type=password&client_id=che-public&username=${CHE_USER}&password=${CHE_PASS}" ${TOKEN_ENDPOINT} | jq -r '.access_token')
}

function checkExitCode() {
	exit_code=$1
	error_msg=$2
    exit=$3

	if [[ $exit_code -eq 0 ]]; then
		echo -e "${GREEN}✔ Done. ${RESET}\n"
	else
		echo -e "${RED}✖ $error_msg  ${RESET}\n"
		if [[ $exit == true ]]; then
            exit 1
        fi
	fi
}

