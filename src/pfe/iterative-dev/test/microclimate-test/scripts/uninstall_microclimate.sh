#!/bin/bash

MC_UNINSTALL_TYPE=$1
MC_INSTALL_ARCH=$2
MC_UNINSTALL_OPTION=$3
MC_RELEASE_DIR=~/microclimate-release
MC_ICP_DIR=~/microclimate-icp
MC_WS_DIR=~/codewind-workspace
MC_CLI_DIR=$MC_RELEASE_DIR/cli

# Test for Windows Host OS
isMicroclimateRunningOnWindows() {
   [[ $(uname -r) =~ Microsoft$ ]]
}

# Colours for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Check arguments
echo -e "${BLUE}Checking arguments... ${RESET}"

if [[ ! $# -gt 1 || ! $# -lt 4 ]]; then
    echo -e "${RED}Wrong Arguments. Please enter:${RESET}"
    echo "Options for Argument 1:"
    echo "local"
    echo "   - clean up microclimate locally"
    echo "icp"
    echo "   - clean up microclimate in ICP"
    echo "Options for Argument 2:"
    echo "x86_64"
    echo "   - clean up microclimate on x86_64"
    echo "ppc64le"
    echo "   - clean up microclimate on ppc64le"
    echo "Options for Argument 3 (Optional):"
    echo "cache"
    echo "   - clean up test cache"
    exit 1
fi

# Check if the first argument is correct
if [[ ($1 != "local" && $1 != "icp") ]]; then
   echo -e "${RED}First argument is not correct, please enter from the following: ${RESET}"
   echo "Options:"
   echo "local"
   echo "   - clean up microclimate locally"
   echo "icp"
   echo "   - clean up microclimate in ICP"
   exit 1
else
   echo -e "${GREEN}First Argument is correct. ${RESET}\n"
fi

# Check if the second argument is correct
if [[ ($2 != "x86_64" && $2 != "ppc64le") ]]; then
   echo -e "${RED}Second argument is not correct, please enter from the following: ${RESET}"
   echo "Options:"
   echo "x86_64"
   echo "   - clean up microclimate on x86_64"
   echo "ppc64le"
   echo "   - tesclean upt microclimate on ppc64le"
   exit 1
else
   echo -e "${GREEN}Second Argument is correct. ${RESET}\n"
fi

# Check if the third argument is present, which is optional
if [[ $3 && $3 == "cache" ]]; then
   echo -e "${GREEN}Third Argument is correct. Cache option has been selected. ${RESET}\n"
   echo -e "${GREEN}This will clean up all the docker images. ${RESET}\n"
elif [[ $3 && $3 == "quarantine" ]]; then
   echo -e "${GREEN}Third Argument is correct. Quarantine option has been selected. ${RESET}\n"
   echo -e "${GREEN}This will clean up all the docker images except cache. ${RESET}\n"
elif [[ $3 && $3 != "cache" ]] || [[ $3 && $3 != "quarantine" ]]; then
   echo -e "${RED}Third Argument is not correct. At this moment, file watcher test only supports the cache and the quarantine option. Exiting... ${RESET}\n"
   exit 1
fi

# Check if CLUSTER_IP is set for ICP on the test host machine
if [[ $DtestType == "icp" && -z $CLUSTER_IP ]]; then
   echo -e "${RED}CLUSTER_IP env var not set. ${RESET}\n"
   exit 1
fi

# For Microclimate to run properly on Windows, it needs to be installed in a
# proper path on the shared c: drive since the Linux subsystem filesystem folder
# structure is not visible to Docker
if isMicroclimateRunningOnWindows; then
   MC_RELEASE_DIR=/c/microclimate-release
   MC_CLI_DIR=$MC_RELEASE_DIR/cli
   MC_WS_DIR=$MC_RELEASE_DIR/codewind-workspace
fi

# Clean up microclimate
if [ $MC_UNINSTALL_TYPE == "local" ]; then
   # Stop microclimate
   echo -e "${BLUE}Stopping microclimate locally... ${RESET}"
   if isMicroclimateRunningOnWindows && [ -e $MC_CLI_DIR/mcdev.ps1 ]; then
      cd $MC_CLI_DIR
      powershell.exe -File mcdev.ps1 stop
      cd ~
   elif [ -e ~/mcdev ]; then
      ~/mcdev stop
      echo -e "${GREEN}Stopped microclimate locally successfully. ${RESET}\n"
   else
      echo -e "${GREEN}Microclimate is already stopped. ${RESET}\n"
   fi

   # Remove microclimate and app containers
   echo -e "${BLUE}Removing microclimate containers... ${RESET}"
   MC_CONTAINERS="docker ps -aq --filter name=microclimate"
   NUMBER_OF_MC_CONTAINERS=$($MC_CONTAINERS | wc -l)

   if [ $NUMBER_OF_MC_CONTAINERS -gt 0 ]; then
      docker rm -f $($MC_CONTAINERS)
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully removed microclimate containers. ${RESET}\n"
      else
         echo -e "${RED}Failed to remove microclimate containers. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There are no microclimate containers to remove. ${RESET}\n"
   fi

   echo -e "${BLUE}Removing app containers... ${RESET}"
   APP_CONTAINERS="docker ps -aq --filter name=mc"
   NUMBER_OF_APP_CONTAINERS=$($APP_CONTAINERS | wc -l)

   if [ $NUMBER_OF_APP_CONTAINERS -gt 0 ]; then
      docker rm -f $($APP_CONTAINERS)
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully removed app containers. ${RESET}\n"
      else
         echo -e "${RED}Failed to remove app containers. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There are no app containers to remove. ${RESET}\n"
   fi

   # Remove microclimate and default networks
   echo -e "${BLUE}Removing codewind network... ${RESET}"
   NUMBER_OF_MC_NETWORK=$(docker network ls | grep codewind_network | wc -l)

   if [ $NUMBER_OF_MC_NETWORK -gt 0 ]; then
      docker network rm codewind_network
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully removed codewind network. ${RESET}\n"
      else
         echo -e "${RED}Failed to remove codewind network. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no codewind network to remove. ${RESET}\n"
   fi

   echo -e "${BLUE}Removing default network... ${RESET}"
   NUMBER_OF_DEFAULT_NETWORK=$(docker network ls | grep codewind_default | wc -l)

   if [ $NUMBER_OF_DEFAULT_NETWORK -gt 0 ]; then
      docker network rm codewind_default
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully removed default network. ${RESET}\n"
      else
         echo -e "${RED}Failed to remove default network. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no default network to remove. ${RESET}\n"
   fi

   # Remove microclimate and app images
   echo -e "${BLUE}Removing microclimate images... ${RESET}"
   MC_IMAGES="docker images -aq --filter reference=*/microclimate*"
   NUMBER_OF_MC_IMAGES=$($MC_IMAGES | wc -l)

   if [ $NUMBER_OF_MC_IMAGES -gt 0 ]; then
      docker rmi -f $($MC_IMAGES)
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully removed microclimate images. ${RESET}\n"
      else
         echo -e "${RED}Failed to remove microclimate images. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There are no microclimate images to remove. ${RESET}\n"
   fi

   echo -e "${BLUE}Removing app images. ${RESET}"
   if [[ $MC_UNINSTALL_OPTION && $MC_UNINSTALL_OPTION == "cache" ]]; then
      echo -e "${GREEN}Cache option has been selected. ${RESET}\n"
      echo -e "${GREEN}Removing all the app images. ${RESET}\n"
      APP_IMAGES="docker images -aq --filter reference=mc*"
   else
      echo -e "${GREEN}Removing all the app images except cache. ${RESET}\n"
      APP_IMAGES="docker images --filter reference=mc* | grep -v cache | tail -n +2 |  awk '{print $3;}'"
   fi
   NUMBER_OF_APP_IMAGES=$($APP_IMAGES | wc -l)

   if [ $NUMBER_OF_APP_IMAGES -gt 0 ]; then
      docker rmi -f $($APP_IMAGES)
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully removed app images. ${RESET}\n"
      else
         echo -e "${RED}Failed to remove app images. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There are no app images to remove. ${RESET}\n"
   fi

   echo -e "${BLUE}Removing none images... ${RESET}"
   NUMBER_OF_NONE_IMAGES=$(docker images | grep "^<none>" | awk "{print \$3}" | wc -l)

   if [ $NUMBER_OF_NONE_IMAGES -gt 0 ]; then
      docker rmi -f $(docker images | grep "^<none>" | awk "{print \$3}")
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully removed none images. ${RESET}\n"
      else
         echo -e "${RED}Failed to remove none images. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There are no none images to remove. ${RESET}\n"
   fi

   # Remove codewind workspace
   echo -e "${BLUE}Removing codewind workspace... ${RESET}"
   if [ -d $MC_WS_DIR ]; then
      rm -rf $MC_WS_DIR
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully removed codewind workspace. ${RESET}\n"
      else
         echo -e "${RED}Failed to remove codewind workspace. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no codewind workspace to remove. ${RESET}\n"
   fi

   # Uninstall microclimate
   echo -e "${BLUE}Uninstalling microclimate... ${RESET}"
   if ! isMicroclimateRunningOnWindows; then
      if [ -d $MC_CLI_DIR ]; then
         cd $MC_CLI_DIR
         ./uninstall.sh
         cd ~
         echo -e "${GREEN}Successfully uninstalled microclimate. ${RESET}\n"
      else
         echo -e "${GREEN}Microclimate is already uninstalled. ${RESET}\n"
      fi
   fi

   # Docker System Prune
   if [[ $MC_UNINSTALL_OPTION && $MC_UNINSTALL_OPTION == "cache" ]]; then
      echo -e "${GREEN}Executing docker system prune. ${RESET}\n"
      docker system prune -af
   fi

elif [ $MC_UNINSTALL_TYPE == "icp" ]; then
   # Login ICP cluster
   echo -e "${BLUE}Loging in ICP cluster... ${RESET}"
   echo -e
   cloudctl login -a https://$CLUSTER_IP:8443 --skip-ssl-validation -n default <<< $'admin\nadmin\n1\n'
   if [ $? -eq 0 ]; then
      echo -e "${GREEN}Successfully logged in ICP cluster. ${RESET}\n"
   else
      echo -e "${RED}Failed to logged in ICP cluster. ${RESET}\n"
      exit 1
   fi

   # Uninstall microclimate in ICP
   echo -e "${BLUE}Uninstalling microclimate in ICP... ${RESET}"
   EXISTING_RELEASE=$(helm list -q | grep microclimate | awk '{print $1;}')

   if [ -n "$EXISTING_RELEASE" ]; then
      helm delete --purge test-microclimate
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully uninstalled microclimate. ${RESET}\n"
      else
         echo -e "${RED}Failed to uninstall microclimate. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no microclimate to uninstall. ${RESET}\n"
   fi

   # Uninstall dangling helm releases
   echo -e "${BLUE}Deleting dangling helm releases... ${RESET}"
   DANGLING_RELEASES=$(helm list -q --namespace default)
   # disable until we get one worker node ICP cluster for caching
   # echo -e "${GREEN}Removing all the dangling helm releases except cache. ${RESET}\n"
   # DANGLING_RELEASES=$(helm list -q --namespace default | grep -v cache)
   # if [[ $MC_UNINSTALL_OPTION && $MC_UNINSTALL_OPTION == "cache" ]]; then
   #   echo -e "${GREEN}Cache option has been selected. ${RESET}\n"
   #   echo -e "${GREEN}Removing all the dangling helm releases. ${RESET}\n"
   #   DANGLING_RELEASES=$(helm list -q --namespace default)
   # fi

   if [ -n "$DANGLING_RELEASES" ]; then
      for RELEASE in $DANGLING_RELEASES; do
         helm delete --purge $RELEASE
         if [ $? -eq 0 ]; then
            echo -e "${GREEN}Successfully uninstalled dangling helm release $RELEASE. ${RESET}\n"
         else
            echo -e "${RED}Failed to uninstall dangling helm release $RELEASE. ${RESET}\n"
            exit 1
         fi

         sleep 5;
      done
   else
      echo -e "${GREEN}There are no dangling helm releases. ${RESET}\n"
   fi

   # Clean image pull secrets in service account
   echo -e "${BLUE}Cleaning up image pull secrets in service account... ${RESET}"
   IMAGE_PULL_SECRETS_NOT_EXISTS=$(kubectl describe serviceaccount default | grep "Image pull secrets" | grep "none")

   if [ -z "$IMAGE_PULL_SECRETS_NOT_EXISTS" ]; then
      kubectl patch serviceaccount default -p '{"imagePullSecrets": []}'
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully cleaned up image pull secrets in service account. ${RESET}\n"
      else
         echo -e "${RED}Failed to clean up image pull secrets in service account. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no image pull secrets in service account. ${RESET}\n"
   fi

   # Clean image pull secrets in service account for services namespace
   echo -e "${BLUE}Cleaning up image pull secrets in service account for services namespace... ${RESET}"
   IMAGE_PULL_SECRETS_NOT_EXISTS=$(kubectl describe serviceaccount default --namespace services | grep "Image pull secrets" | grep "none")

   if [ -z "$IMAGE_PULL_SECRETS_NOT_EXISTS" ]; then
      kubectl patch serviceaccount default -p '{"imagePullSecrets": []}' --namespace services
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully cleaned up image pull secrets in service account for services namespace. ${RESET}\n"
      else
         echo -e "${RED}Failed to clean up image pull secrets in service account for services namespace. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no image pull secrets in service account for services namespace. ${RESET}\n"
   fi

   # Delete secrets
   echo -e "${BLUE}Deleting artifactory secret... ${RESET}"
   ARTIFACTORY_SECRET_EXISTS=$(kubectl get secrets | grep "artifactory")

   if [ -n "$ARTIFACTORY_SECRET_EXISTS" ]; then
      kubectl delete secret artifactory
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully deleted artifactory secret. ${RESET}\n"
      else
         echo -e "${RED}Failed to delete artifactory secret. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no artifactory secret to delete. ${RESET}\n"
   fi

   echo -e "${BLUE}Deleting artifactory secret for services namespace... ${RESET}"
   ARTIFACTORY_SECRET_EXISTS=$(kubectl get secrets --namespace services | grep "artifactory")

   if [ -n "$ARTIFACTORY_SECRET_EXISTS" ]; then
      kubectl delete secret artifactory --namespace services
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully deleted artifactory secret for services namespace. ${RESET}\n"
      else
         echo -e "${RED}Failed to delete artifactory secret for services namespace. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no artifactory secret to delete for services namespace. ${RESET}\n"
   fi

   echo -e "${BLUE}Deleting microclimate registry secret... ${RESET}"
   MICROCLIMATE_REGISTRY_SECRET_EXISTS=$(kubectl get secrets | grep "microclimate-registry-secret")

   if [ -n "$MICROCLIMATE_REGISTRY_SECRET_EXISTS" ]; then
      kubectl delete secret microclimate-registry-secret
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully deleted microclimate registry secret. ${RESET}\n"
      else
         echo -e "${RED}Failed to delete microclimate registry secret. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no microclimate registry secret to delete. ${RESET}\n"
   fi

   echo -e "${BLUE}Deleting microclimate helm secret... ${RESET}"
   MICROCLIMATE_HELM_SECRET_EXISTS=$(kubectl get secrets | grep "microclimate-helm-secret")

   if [ -n "$MICROCLIMATE_HELM_SECRET_EXISTS" ]; then
      kubectl delete secret microclimate-helm-secret
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully deleted microclimate helm secret. ${RESET}\n"
      else
         echo -e "${RED}Failed to delete microclimate helm secret. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no microclimate helm secret to delete. ${RESET}\n"
   fi

   # Sleep 5 minutes to wait for helm releases are deleted completely
   echo -e "${BLUE}Sleep 5 minutes to wait for helm releases are deleted completely... ${RESET}"
   sleep 300

   # Remove codewind workspace
   echo -e "${BLUE}Removing codewind workspace... ${RESET}"
   if [ -d $MC_WS_DIR ]; then
      rm -rf $MC_WS_DIR
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully removed codewind workspace. ${RESET}\n"
      else
         echo -e "${RED}Failed to remove codewind workspace. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no codewind workspace to remove. ${RESET}\n"
   fi
fi

# Delete microclimate release related folders
if [ $MC_UNINSTALL_TYPE == "local" ]; then
   echo -e "${BLUE}Deleting microclimate release folder... ${RESET}"
   if [ -d $MC_RELEASE_DIR ]; then
      rm -rf $MC_RELEASE_DIR
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully deleted microclimate release folder. ${RESET}\n"
      else
         echo -e "${RED}Failed to delete microclimate release folder. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no microclimate release folder to delete. ${RESET}\n"
   fi
elif [ $MC_UNINSTALL_TYPE == "icp" ]; then
   echo -e "${BLUE}Deleting microclimate icp folder... ${RESET}"
   if [ -d $MC_ICP_DIR ]; then
      rm -rf $MC_ICP_DIR
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully deleted microclimate icp folder. ${RESET}\n"
      else
         echo -e "${RED}Failed to delete microclimate icp folder. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no microclimate icp folder to delete. ${RESET}\n"
   fi
fi
