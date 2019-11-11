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

# Developer-mode option for running with appmetrics, see start.sh
DEVMODE=''

printf "\n\n${BLUE}Running 'run.sh' to build and start codewind. $RESET\n";

while [ "$#" -gt 0 ]; do
  case $1 in
    --dev) DEVMODE='--dev'; shift 1;;
    *) shift 1;;
  esac
done

# Set before mvn is run to prevent the reset of the MAVEN_OPTS that can happen if its in the start.sh script
export HOST_MAVEN_OPTS=$MAVEN_OPTS

mvn -v > /dev/null 2>&1
MVN_RET_CODE=$?

if [ "$MVN_RET_CODE" -ne 0 ]; then
  echo "\n${RED}Error: Maven not found. Please install maven to continue local build.$RESET"
  exit 1
fi

# CREATE CODEWIND-WORKSPACE IF NOT EXISTS
printf "\n\n${BLUE}CREATING ~/.codewind IF IT DOESN'T EXIST${RESET}\n"
mkdir -m 777 -p ~/.codewind

# Save the git config required to make an initial commit.
mkdir -m 777 -p ~/.codewind/config
GIT_CONFIG=~/.codewind/config/git.config
rm $GIT_CONFIG
git config -f $GIT_CONFIG --add user.name "`git config --get user.name || echo 'codewind user'`"
git config -f $GIT_CONFIG --add user.email "`git config --get user.email || echo 'codewind.user@localhost'`"

DIR=`pwd`

# Setting the NOBUILD env var to true uses the current images.
# Used in travis when we build and push the images with script/build.sh
# before running the tests via ./test.sh
if [ "$NOBUILD" = "true" ]; then
  echo "*** Using existing images, not performing image rebuild ***"
else
  # Build the docker images
  printf "\n\n${BLUE}BUILDING DOCKER IMAGES${RESET}\n\n";

  ./script/build.sh;

  if [ $? -ne 0 ]; then
    printf "\n${RED}FAILED TO BUILD\nExiting. $RESET";
    exit $?
  else
    printf "\n${GREEN}ALL DOCKER IMAGES SUCCESSFULLY BUILT $RESET\n";
  fi
fi

# Return to starting directory
cd $DIR/

# Start codewind
./start.sh $DEVMODE --tag latest
