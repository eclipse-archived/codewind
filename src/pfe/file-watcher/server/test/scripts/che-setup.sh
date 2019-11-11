#!/usr/bin/env bash
#*******************************************************************************
# Copyright (c) 2019 IBM Corporation and others.
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

CODEWIND_CHE="codewind-che-plugin"
CODEWIND_ODO_EXTENSION="codewind-odo-extension"

CLUSTER_IP=
CLUSTER_USER=
CLUSTER_PASS=
CLUSTER_PORT=8443
CLUSTER_TOKEN=
CHE_ROUTE=
CHE_VERSION="next"
CHE_NS="che"
CLEAN_DEPLOY="n"
OPERATOR_YAML="$CODEWIND_CHE/setup/install_che/che-operator/codewind-checluster.yaml"
SERVICE_ACCOUNT="che-user"
POD_READY_TO=600000
POD_WAIT_TO=1200000

CHE_USER="admin"
CHE_PASS="admin"
DEFAULT_REGISTRY="docker-registry.default.svc:5000"
ADD_DEFAULT_REGISTRY="n"
INSTALL_CW="n"
DEFAULT_DEVFILE="https://raw.githubusercontent.com/eclipse/codewind-che-plugin/master/devfiles/latest/devfile.yaml"
USER_DEVFILE=

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    --cluster-ip        Cluster ip - Required
    --cluster-user      Cluster username - Required
    --cluster-pass      Cluster password - Required
    --cluster-port      Cluster port - default: 8443
    --cluster-token     Cluster token - Optional (can be used instead of user/pass)
    --che-route         Che version to install - default: uses the cluster-ip
    --che-ns            Namespace to install Che - default: che
    --che-version       Che version to install - default: next
    --clean-deploy      Deploy a clean che - default: n
    --operator-yaml     Absolute Path to che operator yaml - default: github.com/eclipse/codewind-che-plugin/master/setup/install_che/che-operator/codewind-checluster.yaml
    --service-account   Service account name - default: che-user
    --podreadytimeout   Pod ready timeout - default: 600000
    --podwaittimeout    Pod wait timeout - default: 1200000
    --default-registry  Enable this flag to add the default docker registry - default: n
    --install-codewind  Enable this flag to install codewind from a devfile - default: https://raw.githubusercontent.com/eclipse/codewind-che-plugin/master/devfiles/latest/devfile.yaml
    -h | --help         Display the man page
EOF
}

function displayMsg() {
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

function installChe() {
    if [ -f "$OPERATOR_YAML" ]; then
        chectl server:start --platform=openshift --installer=operator --che-operator-cr-yaml=$OPERATOR_YAML -n $CHE_NS --k8spodreadytimeout=$POD_READY_TO --k8spodwaittimeout=$POD_WAIT_TO
        displayMsg $? "Failed to clean deploy che." true
    else
        displayMsg 1 "Failed to find operator yaml file on disk." true
    fi
}

function removeCodewindWorkspace() {
    echo -e "${YELLOW}>> Cleaning up existing codewind workspace ${RESET}"

    # Get the Codewind Workspace ID
    CW_POD="$( kubectl get po --selector=app=codewind-pfe --show-labels | tail -n 1 2>/dev/null )"
    if [[ $CW_POD =~ codewindWorkspace=.*, ]]; then
        echo""
        RE_RESULT=${BASH_REMATCH}
        WORKSPACE_ID=$(echo $RE_RESULT | cut -d "=" -f 2 | cut -d "," -f 1)

        getCheAccessToken

        # Stop the Codewind Workspace
        echo -e "${MAGENTA}>>> Stopping workspace ${RESET}"
        HTTPSTATUS=$(curl -I --header 'Authorization: Bearer '"$CHE_ACCESS_TOKEN"'' --request DELETE $CHE_ENDPOINT/api/workspace/$WORKSPACE_ID/runtime 2>/dev/null | head -n 1 | cut -d$' ' -f2)
        if [[ $HTTPSTATUS -ne 204 ]]; then
            displayMsg 1 "Codewind workspace has failed to stop. Will attempt to remove the workspace." false
        fi
        displayMsg 0
        
        # We must wait for the workspace to stop before removing it, otherwise the workspace removal fails
        sleep 10

        # Remove the Codewind Workspace
        echo -e "${MAGENTA}>>> Removing workspace ${RESET}"
        HTTPSTATUS=$(curl -I --header 'Authorization: Bearer '"$CHE_ACCESS_TOKEN"'' --request DELETE $CHE_ENDPOINT/api/workspace/$WORKSPACE_ID 2>/dev/null | head -n 1 | cut -d$' ' -f2)
        if [[ $HTTPSTATUS -ne 204 ]]; then
            displayMsg 1 "Codewind workspace has failed to be removed." true
        fi
        displayMsg 0
    fi
}

function getCheAccessToken() {
    CHE_ACCESS_TOKEN=$(curl -sSL --data "grant_type=password&client_id=che-public&username=${CHE_USER}&password=${CHE_PASS}" ${TOKEN_ENDPOINT} | jq -r '.access_token')
}

while :; do
    case $1 in
        --cluster-ip=?*)
        CLUSTER_IP=${1#*=}
        ;;
        --cluster-user=?*)
        CLUSTER_USER=${1#*=}
        ;;
        --cluster-pass=?*)
        CLUSTER_PASS=${1#*=}
        ;;
        --cluster-port=?*)
        CLUSTER_PORT=${1#*=}
        ;;
        --cluster-token=?*)
        CLUSTER_TOKEN=${1#*=}
        ;;
        --che-route=?*)
        CHE_ROUTE=${1#*=}
        ;;
        --che-version=?*)
        CHE_VERSION=${1#*=}
        ;;
        --che-ns=?*)
        CHE_NS=${1#*=}
        ;;
        --clean-deploy)
        CLEAN_DEPLOY="y"
        ;;
        --default-registry)
        ADD_DEFAULT_REGISTRY="y"
        ;;
        --install-codewind)
        INSTALL_CW="y"
        ;;
        --install-codewind=?*)
        INSTALL_CW="y"
        USER_DEVFILE=${1#*=}
        ;;
        --operator-yaml=?*)
        OPERATOR_YAML=${1#*=}
        ;;
        --service-account=?*)
        SERVICE_ACCOUNT=${1#*=}
        ;;
        --podreadytimeout=?*)
        POD_READY_TO=${1#*=}
        ;;
        --podwaittimeout=?*)
        POD_WAIT_TO=${1#*=}
        ;;
        -h|--help)
        usage
        exit
        ;;
        *) break
    esac
    shift
done

if [[ -z "$CLUSTER_IP" ]]; then
    echo -e "${RED}✖ Cluster ip is a required parameter. ${RESET}\n"
    usage
    exit 1
elif [[ -z "$CLUSTER_USER" ]] && [[ -z "$CLUSTER_TOKEN" ]]; then
    echo -e "${RED}✖ Cluster username or token is a required parameter. ${RESET}\n"
    usage
    exit 1
elif [[ -z "$CLUSTER_PASS" ]] && [[ -z "$CLUSTER_TOKEN" ]]; then
    echo -e "${RED}✖ Cluster password or token is a required parameter. ${RESET}\n"
    usage
    exit 1
fi

# setup for keyclaok
IP_TO_USE="$CLUSTER_IP"
if [[ ! -z "$CHE_ROUTE" ]]; then
    IP_TO_USE="$CHE_ROUTE"
fi

KEYCLOAK_HOSTNAME="keycloak-$CHE_NS.$IP_TO_USE.nip.io"
TOKEN_ENDPOINT="http://${KEYCLOAK_HOSTNAME}/auth/realms/che/protocol/openid-connect/token"
CHE_ENDPOINT="http://che-$CHE_NS.$IP_TO_USE.nip.io"

# check if OC is installed
echo -e "${CYAN}> Checking if openshift cloud is installed${RESET}"
oc > /dev/null 2>&1
OC_EC=$?
displayMsg $OC_EC "Missing openshift cloud command. Please install and try again." true

# login to the cluster
echo -e "${CYAN}> Logging into cluster${RESET}"
LOGIN_FLAGS=
if [[ ! -z "$CLUSTER_TOKEN" ]]; then
    LOGIN_FLAGS="--token=$CLUSTER_TOKEN"
else
    LOGIN_FLAGS="-u $CLUSTER_USER -p $CLUSTER_PASS"
fi

oc login $CLUSTER_IP:$CLUSTER_PORT ${LOGIN_FLAGS}
displayMsg $? "Failed to login. Please check your credentials and try again." true

# check if chectl is installed
echo -e "${CYAN}> Checking if chectl is installed${RESET}"
chectl > /dev/null 2>&1
CHECTL_EC=$?
displayMsg $CHECTL_EC "Missing chectl. Will install for you." false

if [[ $CHECTL_EC != 0 ]]; then
    bash <(curl -sL  https://www.eclipse.org/che/chectl/) --channel=$CHE_VERSION
else
    # switch the chectl channel depending on che version
    echo -e "${CYAN}> Switching to chectl channel: $CHE_VERSION${RESET}"
    chectl update $CHE_VERSION
    displayMsg $? "Failed to switch chectl channel." true
fi

# install resources
echo -e "${CYAN}> Installing codewind che resources${RESET}"
rm -rf $CODEWIND_CHE
git clone git@github.com:eclipse/codewind-che-plugin.git > /dev/null 2>&1
displayMsg $? "Failed to install codewind che resource." true

echo -e "${CYAN}> Installing codewind ODO resources${RESET}"
rm -rf $CODEWIND_ODO_EXTENSION
git clone https://github.com/eclipse/codewind-odo-extension > /dev/null 2>&1
displayMsg $? "Failed to install codewind ODO resource." true

echo -e "${CYAN}> Applying kubectl cluster role${RESET}"
kubectl apply -f "$CODEWIND_CHE/setup/install_che/codewind-clusterrole.yaml" > /dev/null 2>&1
displayMsg $? "Failed to apply kubectl cluster role." true

echo -e "${CYAN}> Applying kubectl role binding${RESET}"
kubectl apply -f "$CODEWIND_CHE/setup/install_che/codewind-rolebinding.yaml" > /dev/null 2>&1
displayMsg $? "Failed to apply kubectl role binding." true

echo -e "${CYAN}> Applying kubectl ODO cluster role${RESET}"
kubectl apply -f "$CODEWIND_ODO_EXTENSION/odo-RBAC/codewind-odoclusterrole.yaml" > /dev/null 2>&1
displayMsg $? "Failed to apply kubectl ODO cluster role." true

echo -e "${CYAN}> Applying kubectl ODO role binding${RESET}"
kubectl apply -f "$CODEWIND_ODO_EXTENSION/odo-RBAC/codewind-odoclusterrolebinding.yaml" > /dev/null 2>&1
displayMsg $? "Failed to apply kubectl ODO role binding." true

# if clean deploy is selected
if [[ $CLEAN_DEPLOY == "y" ]]; then
    echo -e "${CYAN}> Clean deploying che${RESET}\n"

    removeCodewindWorkspace
    displayMsg $? "Failed to remove existing codewind workspace." true

    echo -e "${YELLOW}>> Removing existing namespace ${RESET}"
    oc delete project $CHE_NS --force --grace-period=0 > /dev/null 2>&1

    PROJECTS_LIST=$(oc projects 2>&1)
    echo -e -n "${MAGENTA}>>> Waiting for cleaning up old che resources .${RESET}"
    while [[ ! "$PROJECTS_LIST" =~ "$CHE_NS" ]]; do
        PROJECTS_LIST=$(oc projects 2>&1)
        sleep 2s
        echo -e -n "${MAGENTA}.${RESET}"
    done

    echo ""
    displayMsg $? "Failed to remove existing namespace." true

    installChe

    echo -e "${CYAN}> Creating a service account ${RESET}"
    oc create serviceaccount "$SERVICE_ACCOUNT" > /dev/null 2>&1
    displayMsg $? "Failed to create service account." true
fi

echo -e "${CYAN}> Setting openshift admin policy: privileged ${RESET}"
oc adm policy add-scc-to-group privileged system:serviceaccounts:$CHE_NS > /dev/null 2>&1
displayMsg $? "Failed to set admin policy: privileged." true

echo -e "${CYAN}> Setting openshift admin policy: anyuid ${RESET}"
oc adm policy add-scc-to-group anyuid system:serviceaccounts:$CHE_NS > /dev/null 2>&1
displayMsg $? "Failed to set admin policy: anyuid." true

echo -e "${CYAN}> Adding role image-builder to service account ${RESET}"
oc policy add-role-to-user system:image-builder system:serviceaccount:"$CHE_NS":"$SERVICE_ACCOUNT" > /dev/null 2>&1
displayMsg $? "Failed to add role image-builder to service account." true

HOST_OS=$(uname -a)
echo -e "${CYAN}> Setting os specific base64 encoder ${RESET}"
if [[ "$HOST_OS" =~ "Darwin" ]]; then
    # for macos we need gbase64 - can be downloaded via homebrew - brew install coreutils
    base64Name="gbase64"
    base64=$("$base64Name" --version > /dev/null 2>&1)
    displayMsg $? "Failed to find appropriate base64 converter. Looks like you are mac, please install: brew install coreutils" true
elif [[ "$HOST_OS" =~ "Linux" ]]; then
    # for linux it is called base64
    base64Name="base64"
    base64=$("$base64Name" --version > /dev/null 2>&1)
    displayMsg $? "Failed to find appropriate base64 converter." true
fi

getCheAccessToken

if [[ "$ADD_DEFAULT_REGISTRY" == "y" ]]; then
    echo -e "${CYAN}> Setting docker registry in che ${RESET}"
    ENCODED_TOKEN=$(oc get secret $(oc describe sa $SERVICE_ACCOUNT | tail -n 2 | head -n 1 | awk '{$1=$1};1') -o json | jq ".data.token")
    DECODED_TOKEN=$(echo "$ENCODED_TOKEN" | $base64Name -di)
    REGISTRY_CREDS={\""$DEFAULT_REGISTRY"\":{\"username\":\""$SERVICE_ACCOUNT"\",\"password\":\""$DECODED_TOKEN"\"}}
    DOCKER_CREDS=$(echo -n "$REGISTRY_CREDS" | $base64Name -w 0)
    TIMESTAMP=$(date +"%s")

    curl "$CHE_ENDPOINT/api/preferences" --header 'Authorization: Bearer '"$CHE_ACCESS_TOKEN"'' -H 'Sec-Fetch-Site: same-origin' -H "Content-Type: application/json" --data-binary '{"codenvy:created":'"$TIMESTAMP"',"temporary":"false","git.contribute.activate.projectSelection":"false","dockerCredentials":'"$DOCKER_CREDS"'}'
    displayMsg $? "Failed to set docker registry using default docker registry: $DEFAULT_REGISTRY." false
fi

echo -e "${GREEN}✔ Che is up and running at $CHE_ENDPOINT\n"
echo -e "${GREEN}✔ Login with: $CHE_USER/$CHE_PASS${RESET}\n"

if [[ "$INSTALL_CW" == "y" ]]; then
    if [[ ! -z $USER_DEVFILE ]]; then
        DEFAULT_DEVFILE="$USER_DEVFILE"
    fi
    echo -e "${CYAN}> Installing codewind from devfile: $DEFAULT_DEVFILE ${RESET}\n"

    removeCodewindWorkspace
    displayMsg $? "Failed to remove existing codewind workspace." true

    HTTPSTATUS=$(curl -s $DEFAULT_DEVFILE | curl -s --header "Content-Type: text/yaml" --header 'Authorization: Bearer '"$CHE_ACCESS_TOKEN"'' --request POST --data-binary @- -D- -o/dev/null $CHE_ENDPOINT/api/workspace/devfile?start-after-create=true 2>/dev/null | head -n 1 | cut -d ' ' -f2)
    if [[ $HTTPSTATUS -ne 201 ]]; then
        displayMsg 1 "Codewind workspace setup has failed." true
    fi

    # Wait until the Codewind pod is up and running
    POD_RUNNING=0
    echo -e -n "${YELLOW}>> Waiting for Codewind pod to be created .${RESET}"
    while [ $POD_RUNNING -eq 0 ]; do
	    RESULT="$( kubectl get po --selector=app=codewind-pfe 2>&1 )"
	    if [[ $RESULT = *"Running"* ]]; then
		    POD_RUNNING=1
            echo ""
            displayMsg $? "Codewind pod is now running."
	    elif [[ $RESULT = *"Failure"* || $RESULT = *"Unknown"* || $RESULT = *"ImagePullBackOff"* || $RESULT = *"CrashLoopBackOff"* || $RESULT = *"PostStartHookError"* ]]; then
            echo ""
		    displayMsg 1 "Codewind pod failed to start." true
	    fi
	    sleep 2s
        echo -e -n "${YELLOW}.${RESET}"
    done
fi
