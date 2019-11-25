#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Function to generate the Che Access Token for Che User Authentication
function generateCheAccessToken {
    echo -e "${BLUE}Generating the Che Access Token ${RESET}\n"
    CHE_USER="admin"
    CHE_PASS="admin"

    KEYCLOAK_HOSTNAME=keycloak-"$NAMESPACE"."$CLUSTER_IP".nip.io
    TOKEN_ENDPOINT="http://${KEYCLOAK_HOSTNAME}/auth/realms/che/protocol/openid-connect/token" 
    CHE_ACCESS_TOKEN=$(curl -sSL --data "grant_type=password&client_id=che-public&username=${CHE_USER}&password=${CHE_PASS}" ${TOKEN_ENDPOINT} | jq -r '.access_token')
}