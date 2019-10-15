#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

CODEWIND_CHE="codewind-che-plugin"
CODEWIND_ODO_EXTENSION="codewind-odo-extension"

CLUSTER_IP=
CLUSTER_USER=
CLUSTER_PASS=
CHE_VERSION="next"
CHE_NS="che"
CLEAN_DEPLOY="n"
OPERATOR_YAML="$CODEWIND_CHE/setup/install_che/che-operator/codewind-checluster.yaml"
SERVICE_ACCOUNT="che-user"

CHE_USER="admin"
CHE_PASS="admin"
DEFAULT_REGISTRY="docker-registry.default.svc:5000"

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    --cluster-ip        Cluster ip - Required
    --cluster-user      Cluster username - Required
    --cluster-pass      Cluster password - Required
    --che-version       Che version to install - default: next 
    --che-ns            Namespace to install Che - default: che
    --clean-deploy      Deploy a clean che - default: n
    --operator-yaml     Absolute Path to che operator yaml - default: github.com/eclipse/codewind-che-plugin/master/setup/install_che/che-operator/codewind-checluster.yaml
    --service-account   Service account name - default: che-user
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
            chectl server:start --platform=openshift --installer=operator --che-operator-cr-yaml=$OPERATOR_YAML -n $CHE_NS
        else
            displayMsg 1 "Failed to find operator yaml file on disk." true
    fi
    oc adm policy add-scc-to-group privileged system:serviceaccounts:$CHE_NS
    displayMsg $? "Failed to set admin policy: privileged." true

    oc adm policy add-scc-to-group anyuid system:serviceaccounts:$CHE_NS
    displayMsg $? "Failed to set admin policy: anyuid." true
}


while [ "$#" -gt 0 ]; do
    case $1 in
        --cluster-ip )          shift
                                CLUSTER_IP=$1
                                ;;
        --cluster-user )        shift
                                CLUSTER_USER=$1
                                ;;
        --cluster-pass )        shift
                                CLUSTER_PASS=$1
                                ;;
        --che-version )         shift
                                CHE_VERSION=$1
                                ;;
        --che-ns )              shift
                                CHE_NS=$1
                                ;;
        --clean-deploy )        shift
                                CLEAN_DEPLOY=$1
                                ;;
        --operator-yaml )       shift
                                OPERATOR_YAML=$1
                                ;;
        --service-account )     shift
                                SERVICE_ACCOUNT=$1
                                ;;
        -h | --help )           usage
                                exit
                                ;;
        * )                     usage
                                exit 1
    esac
    shift
done

if [[ -z "$CLUSTER_IP" ]]; then
    echo -e "${RED}✖ Cluster ip is a required parameter. ${RESET}\n"
    usage
    exit 1
elif [[ -z "$CLUSTER_USER" ]]; then
    echo -e "${RED}✖ Cluster username is a required parameter. ${RESET}\n"
    usage
    exit 1
elif [[ -z "$CLUSTER_PASS" ]]; then
    echo -e "${RED}✖ Cluster password is a required parameter. ${RESET}\n"
    usage
    exit 1
fi

# setup for keyclaok
KEYCLOAK_HOSTNAME="keycloak-$CHE_NS.$CLUSTER_IP"
TOKEN_ENDPOINT="http://${KEYCLOAK_HOSTNAME}/auth/realms/che/protocol/openid-connect/token"

# check if OC is installed
echo -e "${BLUE}> Checking if openshift cloud is installed${RESET}"
oc > /dev/null 2>&1
OC_EC=$?
displayMsg $OC_EC "Missing openshift cloud command. Please install and try again." true

# login to the cluster
echo -e "${BLUE}> Logging into cluster${RESET}"
oc login $CLUSTER_IP:8443 -u $CLUSTER_USER -p $CLUSTER_PASS --insecure-skip-tls-verify=true
displayMsg $? "Failed to login. Please check your credentials and try again." true

# check if chectl is installed
echo -e "${BLUE}> Checking if chectl is installed${RESET}"
chectl > /dev/null 2>&1
CHECTL_EC=$?
displayMsg $CHECTL_EC "Missing chectl. Will install for you." false

if [[ $CHECTL_EC != 0 ]]; then
    bash <(curl -sL  https://www.eclipse.org/che/chectl/) --channel=$CHE_VERSION
else
    # switch the chectl channel depending on che version
    echo -e "${BLUE}> Switching to chectl channel: $CHE_VERSION${RESET}"
    chectl update $CHE_VERSION
    displayMsg $? "Failed to switch chectl channel." true
fi

# install resources
echo -e "${BLUE}> Installing codewind che resources${RESET}"
rm -rf $CODEWIND_CHE
git clone git@github.com:eclipse/codewind-che-plugin.git > /dev/null 2>&1
displayMsg $? "Failed to install codewind che resource." true

echo -e "${BLUE}> Installing codewind ODO resources${RESET}"
rm -rf $CODEWIND_ODO_EXTENSION
git clone https://github.com/eclipse/codewind-odo-extension > /dev/null 2>&1
displayMsg $? "Failed to install codewind ODO resource." true

echo -e "${BLUE}> Applying kubectl cluster role${RESET}"
kubectl apply -f "$CODEWIND_CHE/setup/install_che/codewind-clusterrole.yaml"
displayMsg $? "Failed to apply kubectl cluster role." true

echo -e "${BLUE}> Applying kubectl role binding${RESET}"
kubectl apply -f "$CODEWIND_CHE/setup/install_che/codewind-rolebinding.yaml"
displayMsg $? "Failed to apply kubectl role binding." true

echo -e "${BLUE}> Applying kubectl ODO cluster role${RESET}"
kubectl apply -f "$CODEWIND_ODO_EXTENSION/odo-RBAC/codewind-odoclusterrole.yaml"
displayMsg $? "Failed to apply kubectl ODO cluster role." true

echo -e "${BLUE}> Applying kubectl ODO role binding${RESET}"
kubectl apply -f "$CODEWIND_ODO_EXTENSION/odo-RBAC/codewind-odoclusterrolebinding.yaml"
displayMsg $? "Failed to apply kubectl ODO role binding." true

# if clean deploy is selected
if [[ $CLEAN_DEPLOY == "y" ]]; then
    echo -e "${BLUE}> Clean deploying che${RESET}"
    oc delete project $CHE_NS --force --grace-period=0 > /dev/null 2>&1
    installChe
    displayMsg $? "Failed to clean deploy che." true
fi

echo -e "${BLUE}> Creating a service account ${RESET}"
oc create serviceaccount "$SERVICE_ACCOUNT"
displayMsg $? "Failed to create service account." true

echo -e "${BLUE}> Adding role image-builder to service account ${RESET}"
oc policy add-role-to-user system:image-builder system:serviceaccount:"$CHE_NS":"$SERVICE_ACCOUNT"
displayMsg $? "Failed to add role image-builder to service account." true

HOST_OS=$(uname -a)
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

ENCODED_TOKEN=$(oc get secret $(oc describe sa $SERVICE_ACCOUNT | tail -n 2 | head -n 1 | awk '{$1=$1};1') -o json | jq ".data.token")
DECODED_TOKEN=$(echo "$ENCODED_TOKEN" | $base64Name -di)
echo "Registry is: docker-registry.default.svc:5000"
echo -e "Token is: $DECODED_TOKEN \n"

KEYCLOAK_HOSTNAME=keycloak-"$CHE_NS"."$CLUSTER_IP".nip.io
TOKEN_ENDPOINT="http://${KEYCLOAK_HOSTNAME}/auth/realms/che/protocol/openid-connect/token" 
export CHE_ACCESS_TOKEN=$(curl -sSL --data "grant_type=password&client_id=che-public&username=${CHE_USER}&password=${CHE_PASS}" ${TOKEN_ENDPOINT} | jq -r '.access_token')
echo -e "CHE Access Token is: $CHE_ACCESS_TOKEN \n"

echo -e "${GREEN}✔ Che is up and running at che-$CHE_NS.$CLUSTER_IP.nip.io\n"
echo -e "${GREEN}✔ Username: $CHE_USER${RESET}\n"
echo -e "${GREEN}✔ Password: $CHE_PASS${RESET}\n"
