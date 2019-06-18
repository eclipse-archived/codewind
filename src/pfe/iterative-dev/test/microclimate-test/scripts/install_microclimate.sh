#!/bin/bash

MC_DOWNLOAD_TYPE=$1
MC_RELEASE_TAG=$2
MC_INSTALL_TYPE=$3
MC_INSTALL_ARCH=$4
MC_RELEASE_REPO_URL="git@github.ibm.com:dev-ex/microclimate-release.git -b $MC_RELEASE_TAG"
MC_ICP_REPO_URL=git@github.ibm.com:dev-ex/microclimate-icp.git
MC_RELEASE_DIR=~/microclimate-release
MC_ICP_DIR=~/microclimate-icp
MC_CLI_DIR=$MC_RELEASE_DIR/cli
MC_DIR=~/microclimate
MC_NIGHTLY_RUN_DIR=$MC_DIR/src/pfe/iterative-dev/test/microclimate-test/scripts
OVERRIDES_FILE=""
OS=$(uname -a | awk '{print $1;}')

# Test for Windows Host OS
isMicroclimateRunningOnWindows() {
   [[ $(uname -r) =~ Microsoft$ ]]
}

# Colours for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Install log4js module since get_cookie.js needs it
echo -e "${BLUE}Installing node package log4js for get_cookie script ... ${RESET}"
npm install --prefix $MC_DIR log4js

# Check argument
echo -e "${BLUE}Checking argument... ${RESET}"
if [[ $# -ne 4 || ($1 != "zip" && $1 != "git") || ( -z "$2" ) || ($3 != "local" && $3 != "icp") || ($4 != "x86_64" && $4 != "ppc64le")]]; then
   echo -e "${RED}Arguments are not correct, please input four arguments. ${RESET}"
   echo "First argument options:"
   echo "git"
   echo "   - download microclimate from github"
   echo "Second argument options:"
   echo "master"
   echo "   - install the latest microclimate"
   echo "<release tag>"
   echo "   - install the latest microclimate from <release tag>"
   echo "   - please check the artifactory for a list of release tags"
   echo "Third argument options:"
   echo "local"
   echo "   - install microclimate locally"
   echo "icp"
   echo "   - install microclimate in ICP"
   echo "Fourth argument options:"
   echo "x86_64"
   echo "   - install microclimate on x86_64"
   echo "ppc64le"
   echo "   - install microclimate on ppc64le"
   exit 1
else
   echo -e "${GREEN}Arguments are correct. ${RESET}\n"
fi

# Check the cluster architecture and define the overrides file
if [ $MC_INSTALL_ARCH == "x86_64" ]; then
   OVERRIDES_FILE=dev-overrides-amd64.yaml
elif [ $MC_INSTALL_ARCH == "ppc64le" ]; then
   OVERRIDES_FILE=dev-overrides-ppc64le.yaml
fi

# For Microclimate to run properly on Windows, it needs to be installed in a proper
# path on the shared c: drive since the Linux subsystem filesystem folder structure is
# not visible to Docker
if isMicroclimateRunningOnWindows; then
   MC_RELEASE_DIR=/c/microclimate-release
   MC_CLI_DIR=$MC_RELEASE_DIR/cli
fi

# Go to home directory for non-Windows and to c:\ for Windows
if isMicroclimateRunningOnWindows; then
   cd /c/
else
   cd ~
fi

# Download microclimate
if [ $MC_DOWNLOAD_TYPE == "git" ]; then
   if [ $MC_INSTALL_TYPE == "local" ]; then
      echo -e "${BLUE}Downloading microclimate release from github... ${RESET}"
      if [ -d $MC_RELEASE_DIR ]; then
         rm -rf $MC_RELEASE_DIR
      fi
      git clone $MC_RELEASE_REPO_URL
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully downloaded microclimate release from github. ${RESET}\n"
      else
         echo -e "${RED}Failed to download microclimate release from github. ${RESET}\n"
         exit 1
      fi
      # For windows, since the microclimate release files were created via git in the Linux subsystem,
      # the files need to be copied via a windows copy command to create native windows files
      # which is required for Microclimate to function properly within Docker on Windows
      if isMicroclimateRunningOnWindows; then
         cmd.exe /c "ren c:\\microclimate-release microclimate-release.temp"
         cmd.exe /c "md c:\\microclimate-release"
         xcopy.exe c:\\microclimate-release.temp c:\\microclimate-release /s/e/h
         cmd.exe /c "rd /s/q c:\\microclimate-release.temp"
      fi
   elif [ $MC_INSTALL_TYPE == "icp" ]; then
      echo -e "${BLUE}Downloading microclimate icp from github... ${RESET}"
      if [ -d $MC_ICP_DIR ]; then
         rm -rf $MC_ICP_DIR
      fi
      git clone $MC_ICP_REPO_URL
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully downloaded microclimate icp from github. ${RESET}\n"
      else
         echo -e "${RED}Failed to download microclimate from icp github. ${RESET}\n"
         exit 1
      fi
   fi
fi

# Install microclimate
if [ $MC_INSTALL_TYPE == "local" ]; then
   echo -e "${BLUE}Installing microclimate locally... ${RESET}"
   if [ -d $MC_CLI_DIR ]; then
      cd $MC_CLI_DIR
      if isMicroclimateRunningOnWindows; then
         powershell.exe -File install.ps1
      else
         ./install.sh
         cd ..
      fi
      echo -e "${GREEN}Successfully installed microclimate locally. ${RESET}\n"
   else
      echo -e "${RED}Failed to install microclimate locally because the cli dirctory does not exist. ${RESET}\n"
      exit 1
   fi
elif [ $MC_INSTALL_TYPE == "icp" ]; then

   # Check if DOCKER_USERID and DOCKER_PASSWORD are set on the test host machien
   if [[ -z $DOCKER_USERID || -z $DOCKER_PASSWORD ]]; then
      echo -e "${RED}DOCKER_USERID or DOCKER_PASSWORD env var not set. ${RESET}\n"
      exit 1
   fi

   # Check if CLUSTER_IP and PROXY_IP are set on the test host machine
   if [[ -z $CLUSTER_IP || -z $PROXY_IP ]]; then
      echo -e "${RED}CLUSTER_IP or PROXY_IP env var not set. ${RESET}\n"
      exit 1
   fi

   # Login ICP cluster
   echo -e "${BLUE}Loging in ICP cluster... ${RESET}"
   cloudctl login -a https://$CLUSTER_IP:8443 --skip-ssl-validation -n default <<< $'admin\nadmin\n1\n'
   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully logged in ICP cluster. ${RESET}\n"
   else
      echo -e "${RED}Failed to logged in ICP cluster. ${RESET}\n"
      exit 1
   fi

   # Create secrets
   echo -e "${BLUE}Creating artifactory secret... ${RESET}"
   kubectl create secret docker-registry artifactory --docker-server=sys-mcs-docker-local.artifactory.swg-devops.com --docker-username=$DOCKER_USERID --docker-password=$DOCKER_PASSWORD --docker-email=$DOCKER_USERID
   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully created artifactory secret. ${RESET}\n"
   else
      echo -e "${RED}Failed to create artifactory secret. ${RESET}\n"
      exit 1
   fi

   echo -e "${BLUE}Creating artifactory secret for services namespace... ${RESET}"
   kubectl create secret docker-registry artifactory --docker-server=sys-mcs-docker-local.artifactory.swg-devops.com --docker-username=$DOCKER_USERID --docker-password=$DOCKER_PASSWORD --docker-email=$DOCKER_USERID --namespace services
   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully created artifactory secret for services namespace. ${RESET}\n"
   else
      echo -e "${RED}Failed to create artifactory secret for services namespace. ${RESET}\n"
      exit 1
   fi

   echo -e "${BLUE}Creating microclimate registry secret... ${RESET}"
   kubectl create secret docker-registry microclimate-registry-secret --docker-server=mycluster.icp:8500 --docker-username=admin --docker-password=admin --docker-email=test@test.com
   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully created microclimate registry secret. ${RESET}\n"
   else
      echo -e "${RED}Failed to create microclimate registry secret. ${RESET}\n"
      exit 1
   fi

   echo -e "${BLUE}Creating microclimate helm secret... ${RESET}"
   if [ $OS == "Linux" ]; then
      kubectl create secret generic microclimate-helm-secret --from-file=cert.pem=/root/.helm/cert.pem --from-file=ca.pem=/root/.helm/ca.pem --from-file=key.pem=/root/.helm/key.pem
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully created microclimate helm secret. ${RESET}\n"
      else
         echo -e "${RED}Failed to create microclimate helm secret. ${RESET}\n"
         exit 1
      fi
   elif [ $OS == "Darwin" ]; then
      kubectl create secret generic microclimate-helm-secret --from-file=cert.pem=/Users/$USER/.helm/cert.pem --from-file=ca.pem=/Users/$USER/.helm/ca.pem --from-file=key.pem=/Users/$USER/.helm/key.pem
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully created microclimate helm secret. ${RESET}\n"
      else
         echo -e "${RED}Failed to create microclimate helm secret. ${RESET}\n"
         exit 1
      fi
   fi

   # Create service account
   echo -e "${BLUE}Creating service account... ${RESET}"
   kubectl patch serviceaccount default -p '{"imagePullSecrets": [{"name": "artifactory"}, {"name": "microclimate-registry-secret"}, {"name": "microclimate-helm-secret"}]}'
   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully created service account. ${RESET}\n"
   else
      echo -e "${RED}Failed to create service account. ${RESET}\n"
      exit 1
   fi

   # Create service account for services namespace
   echo -e "${BLUE}Creating service account for services namespace... ${RESET}"
   kubectl patch serviceaccount default -p '{"imagePullSecrets": [{"name": "artifactory"}]}' --namespace services
   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully created service account for services namespace. ${RESET}\n"
   else
      echo -e "${RED}Failed to create service account for services namespace. ${RESET}\n"
      exit 1
   fi

   # Install microclimate in ICP
   echo -e "${BLUE}Installing microclimate in icp... ${RESET}"

   if [ $OS == "Linux" ]; then
      sed -i 's/<proxy.ip>/'"$PROXY_IP"'/g' $MC_ICP_DIR/dev-utils/$OVERRIDES_FILE
   elif [ $OS == "Darwin" ]; then
      sed -i '' 's/<proxy.ip>/'"$PROXY_IP"'/g' $MC_ICP_DIR/dev-utils/$OVERRIDES_FILE
   fi

   cd $MC_ICP_DIR
   if [ $MC_RELEASE_TAG == "master" ]; then
      echo -e "${BLUE}Installing release: $MC_RELEASE_TAG ${RESET}"
      helm install --name test-microclimate -f dev-utils/$OVERRIDES_FILE stable/ibm-microclimate
   else
      echo -e "${BLUE}Installing release: $MC_RELEASE_TAG ${RESET}"
      helm install --name test-microclimate -f dev-utils/$OVERRIDES_FILE stable/ibm-microclimate --set filewatcher.tag=$MC_RELEASE_TAG --set beacon.tag=$MC_RELEASE_TAG --set portal.tag=$MC_RELEASE_TAG
   fi

   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully installed microclimate in icp for release: $MC_RELEASE_TAG ${RESET}"
   else
      echo -e "${RED}Failed to install microclimate in icp for release: $MC_RELEASE_TAG ${RESET}"
      exit 1
   fi

   # Sleep 5 minutes to wait microclimate pods are running and ready
   echo -e "${BLUE}Sleep 5 minutes to wait for microclimate pods are running and ready... ${RESET}"
   sleep 300

   # Log in ICP as admin/admin to let file watcher and editor pods up and running
   echo -e "${BLUE}Logging in icp as admin/admin... ${RESET}"
   COOKIE=`node $MC_NIGHTLY_RUN_DIR/get_cookie.js https://microclimate.$PROXY_IP.nip.io/ admin admin`
   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully logged in icp. ${RESET}\n"
   else
      echo -e "${RED}Failed to log in icp. ${RESET}\n"
      exit 1
   fi

   # Sleep 3 minutes to wait file watcher and editor pods are running and ready
   echo -e "${BLUE}Sleep 3 minutes to wait for file watcher and editor pods are running and ready... ${RESET}"
   sleep 180
fi

# Start microclimate
if [ $MC_INSTALL_TYPE == "local" ]; then
   echo -e "${BLUE}Starting microclimate locally... ${RESET}"
   if isMicroclimateRunningOnWindows; then
      powershell.exe -File mcdev.ps1 start
      cd ~
   elif [ $OS == "Linux" ]; then
      mcdev start
   elif [ $OS == "Darwin" ]; then
      ~/mcdev start
   fi
   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully started microclimate locally. ${RESET}\n"
   else
      echo -e "${RED}Failed to start microclimate locally. ${RESET}\n"
      exit 1
   fi
fi
