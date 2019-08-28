#!/usr/bin/env sh
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

# Colours for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

REMOVE_IMAGES=false;
REMOVE_ALL=false;
REMOVE_UNTAGGED=false;
REMOVE_APP_IMAGES=false;

# flags
while test $# -gt 0; do
  case "$1" in
    -h|--help)
      printf "\n./stop.sh [options]\n\n";
      echo "options:";
      echo "   -h, --help";
      echo "   -a, --all";
      echo "       Stop and remove ALL Docker containers instead of just Codewind ones.";
      echo "   -p, --appimages";
      echo "       Remove application images as well as containers.";
      echo "   -i, --images";
      echo "       Remove images as well as containers.";
      echo "       Hint: Use with --all to remove clear your Docker repository (remove containers and images).";
      echo "   -u, --untagged";
      echo "       Remove images untagged images (tag will look like: <none>).";
      echo "       Hint: This helps to recover space in your Docker repository.";
      exit;
      ;;
    -a|--all)
      REMOVE_ALL=true;
      shift
      ;;
    -i|--images)
      echo "The Docker images will also be removed";
      REMOVE_IMAGES=true;
      shift
      ;;
    -p|--appimages)
      echo "The Application Docker images will also be removed";
      REMOVE_APP_IMAGES=true;
      shift
      ;;
    -u|--untagged)
      echo "The Docker images will also be removed";
      REMOVE_UNTAGGED=true;
      shift
      ;;
    *)
      break;
      ;;
  esac
done

# If REMOVE_ALL then remove all containers instead of just Codewind ones
if [ ${REMOVE_ALL} = true ]; then
  printf "\nStopping and removing ALL Docker containers instead of just Codewind ones.\n";
  DOCKER_PS="docker ps -a -q";
  DOCKER_IMAGES="docker images -q";
else
  printf "\nStopping and removing Codewind Docker containers.\n"
  DOCKER_PS="docker ps -a -q  --filter name=codewind";
  DOCKER_IMAGES="docker images -q --filter reference=codewind*";
fi

DOCKER_PS_APPS="docker ps -a -q  --filter name=cw";
DOCKER_IMAGES_APPS="docker images -q --filter reference=cw*";

# Check to make sure that there are actually proceses to remove
NUMBER_OF_PROCESSES=$($DOCKER_PS | wc -l)
if [ $NUMBER_OF_PROCESSES -gt 0 ]; then
  # Removing containers
  printf "\n${BLUE}Running 'stop.sh' to stop and remove Docker containers. ${RESET}\n";
  printf "Docker ps script is '${DOCKER_PS}'\n";

  printf "\nStopping all running containers\n";

  docker rm -f $($DOCKER_PS)
  if [ $? -eq 0 ]; then
      printf "\n${GREEN}Successfully removed containers $RESET\n";
  else
      printf "\n${RED}Error removing containers $RESET\n";
      exit;
  fi
  printf "\n${GREEN}SUCCESSFULLY REMOVED CONTAINERS $RESET\n";
else
  printf "\n${RED}ERROR: THERE ARE NO CONTAINERS TO REMOVE $RESET\n";
fi

# Check to make sure that there are actually proceses to remove
NUMBER_OF_PROCESSES=$($DOCKER_PS_APPS | wc -l)
if [ $NUMBER_OF_PROCESSES -gt 0 ]; then
  # Removing containers
  docker rm -f $($DOCKER_PS_APPS)
  if [ $? -eq 0 ]; then
      printf "\n${GREEN}Successfully removed containers $RESET\n";
  else
      printf "\n${RED}Error removing containers $RESET\n";
      exit;
  fi
  printf "\n${GREEN}SUCCESSFULLY REMOVED CONTAINERS $RESET\n";
else
  printf "\n${RED}ERROR: THERE ARE NO CONTAINERS TO REMOVE $RESET\n";
fi

# Remove the codewind network
printf "\nRemoving docker network\n";
docker network rm codewind_network
if [ $? -eq 0 ]; then
    printf "\n${GREEN}Successfully removed docker network $RESET\n";
else
    printf "\n${RED}Error removing docker network $RESET\n";
fi

# Remove the default network

# Remove images if --image or -i tag is given
if [ ${REMOVE_IMAGES} = true ]; then
  # Check to make sure that there are images to remove
  NUMBER_OF_IMAGES=$($DOCKER_IMAGES | wc -l)
  if [ $NUMBER_OF_IMAGES -gt 0 ]; then
    # Sleep as removing Docker images can be inconvenient if done by accident
    printf "\n${BLUE}NOW REMOVING IMAGES.\nTHIS IS IRREVERSIBLE SO PAUSING FOR 5 SECONDS.${RESET}\n";
    sleep 5;
    printf "\nRemoving Images\n";
    docker rmi -f $($DOCKER_IMAGES)
    if [ $? -eq 0 ]; then
        printf "\n${GREEN}Successfully removed images $RESET\n";
    else
        printf "\n${RED}Error removing images $RESET\n";
        exit;
    fi
  else
    printf "\n${RED}ERROR: THERE ARE NO IMAGES TO REMOVE $RESET\n";
  fi
fi

# Remove app images if --appimages or -p flag is given
if [ ${REMOVE_APP_IMAGES} = true ]; then
  echo "Removing app images"
  # Check to make sure that there are images to remove
  NUMBER_OF_IMAGES=$($DOCKER_IMAGES_APPS | wc -l)
  if [ $NUMBER_OF_IMAGES -gt 0 ]; then
    # Sleep as removing Docker images can be inconvenient if done by accident
    printf "\n${BLUE}NOW REMOVING IMAGES.\nTHIS IS IRREVERSIBLE SO PAUSING FOR 5 SECONDS.${RESET}\n";
    sleep 5;
    printf "\nRemoving Images\n";
    docker rmi -f $($DOCKER_IMAGES_APPS)
    if [ $? -eq 0 ]; then
        printf "\n${GREEN}Successfully removed images $RESET\n";
    else
        printf "\n${RED}Error removing images $RESET\n";
        exit;
    fi
  else
    printf "\n${RED}ERROR: THERE ARE NO APP IMAGES TO REMOVE $RESET\n";
  fi
fi

# Remove untagged images is -u or --untagged tag is given
if [ ${REMOVE_UNTAGGED} = true ]; then
  printf "\n${BLUE}REMOVING UNTAGGED IMAGES.\nTHIS MAY HAVE ERRORS AS SOME IMAGES ARE REFERENCED IN OTHER REPOSITORIES.${RESET}\n";
  docker rmi $(docker images | grep "^<none>" | awk "{print \$3}");
  if [ $? -eq 0 ]; then
      printf "\n${GREEN}Successfully removed untagged images $RESET\n";
  else
      printf "\n${RED}Error removing untagged images $RESET\n";
      exit;
  fi
fi
