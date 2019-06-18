#!/bin/bash

MC_UNINSTALL_TYPE=$1
MC_DIR=~/microclimate
IDC_META_DIR=~/.idc

# Colours for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Check argument
echo -e "${BLUE}Checking argument... ${RESET}"
if [[ $# -ne 1 || ($1 != "local" && $1 != "icp") ]]; then
   echo -e "${RED}Argument is not correct, please input only one argument. ${RESET}"
   echo "Options:"
   echo "local"
   echo "   - clean up microclimate locally"
   echo "icp"
   echo "   - clean up microclimate in ICP"
   exit 1
else
   echo -e "${GREEN}Argument is correct. ${RESET}\n"
fi

# Clean up microcliamte
if [ $MC_UNINSTALL_TYPE == "local" ]; then

    # Remove app containers
   echo -e "${BLUE}Removing app containers... ${RESET}"
   APP_CONTAINERS="docker ps -aq --filter name=iterative-dev-app-idc"
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

   # Remove  app images
   
   echo -e "${BLUE}Removing app images... ${RESET}"
   APP_IMAGES="docker images -aq --filter reference=iterative-dev-app-idc*"
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

   # Remove .idc metadir
   echo -e "${BLUE}Removing idc metadir... ${RESET}"
   if [ -d $IDC_META_DIR ]; then
      rm -rf $IDC_META_DIR
      if [ $? -eq 0 ]; then
         echo -e "${GREEN}Successfully removed idc metadir. ${RESET}\n"
      else
         echo -e "${RED}Failed to remove idc metadir. ${RESET}\n"
         exit 1
      fi
   else
      echo -e "${GREEN}There is no idc metadir to remove. ${RESET}\n"
   fi
fi