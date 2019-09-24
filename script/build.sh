#!/bin/bash
#
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

# README FIRST !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
# 
# NOTE: change of this file should be in sync with 'Jenkinsfile(stage: Build Docker images)'
# Ping kjoseph@ca.ibm.com for details
#
# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

DIR=`pwd`;
SRC_DIR=$DIR/src;
PFE=pfe
INITIALIZE=initialize
PERFORMANCE=performance;
ARCH=`uname -m`;
TAG=latest;
REGISTRY=eclipse

# On intel, uname -m returns "x86_64", but the convention for our docker images is "amd64"
if [ "$ARCH" == "x86_64" ]; then
  IMAGE_ARCH="amd64"
else
  IMAGE_ARCH=$ARCH
fi

ALL_IMAGES="$PFE $PERFORMANCE $INITIALIZE";

# Copy .env over to file-watcher
if [ -f $DIR/.env ]; then
  echo -e "\nCopying $DIR/.env to ${SRC_DIR}/${PFE}/file-watcher/scripts/.env\n"
  cp $DIR/.env ${SRC_DIR}/${PFE}/file-watcher/scripts/.env
fi

# Copy the license files to the portal, performance, initialize
cp -r $DIR/LICENSE.md ${SRC_DIR}/pfe/portal/
cp -r $DIR/NOTICE.md ${SRC_DIR}/pfe/portal/
cp -r $DIR/LICENSE ${SRC_DIR}/initialize/
cp -r $DIR/NOTICE.md ${SRC_DIR}/initialize/
cp -r $DIR/LICENSE.md ${SRC_DIR}/performance/
cp -r $DIR/NOTICE.md ${SRC_DIR}/performance/

# Copy the docs into portal
cp -r $DIR/docs ${SRC_DIR}/pfe/portal/

# Copy the appsody extension into portal. The zip file must have a version number e.g. codewind-appsody-extension-0.3.0.zip
# in order for it to be accepted as a valid extension

mkdir -p ${SRC_DIR}/pfe/extensions
rm -f ${SRC_DIR}/pfe/extensions/codewind-appsody-extension-*.zip

DOWNLOAD_APPSODY_EXT_VERSION="0.5.0"

# - If APPSODY_EXT_VERSION=none, skip the download
# - If APPSODY_EXT_VERSION is not set, set to the default version
# - If value is set for APPSODY_EXT_VERSION, attempt to download it (no error if invalid)
if [ "$APPSODY_EXT_VERSION" == "none" ]; then
  DOWNLOAD_APPSODY_EXT_VERSION="none"
elif [ ! -z "$APPSODY_EXT_VERSION" ]; then 
  DOWNLOAD_APPSODY_EXT_VERSION=$APPSODY_EXT_VERSION
fi

if [ "$DOWNLOAD_APPSODY_EXT_VERSION" == "none" ]; then 
    echo -e "\n+++   SKIPPING APPSODY EXTENSION DOWNLOAD DUE TO ENV VARIABLE APPSODY_EXT_VERSION=none +++\n";
  else
    echo -e "\n+++   DOWNLOADING DEFAULT APPSODY EXTENSION: ${DOWNLOAD_APPSODY_EXT_VERSION}  +++\n";
    curl -Lo ${SRC_DIR}/pfe/extensions/codewind-appsody-extension-${DOWNLOAD_APPSODY_EXT_VERSION}.zip https://github.com/eclipse/codewind-appsody-extension/archive/${DOWNLOAD_APPSODY_EXT_VERSION}.zip
fi

# BUILD IMAGES
# Uses a build file in each of the directories that we want to use
echo -e "\n+++   BUILDING DOCKER IMAGES   +++\n";

for image in $ALL_IMAGES
do
  export IMAGE_NAME=codewind-$image-$IMAGE_ARCH
  echo Building image $IMAGE_NAME;
  cd ${SRC_DIR}/${image};
  time sh build Dockerfile_${ARCH};

  if [ $? -eq 0 ]; then
    echo "+++   SUCCESSFULLY BUILT $IMAGE_NAME   +++";
  else
    echo "+++   FAILED TO BUILD $IMAGE_NAME - exiting.   +++";
    exit 12;
  fi
done;
echo -e "\n+++   ALL DOCKER IMAGES SUCCESSFULLY BUILT   +++\n";
docker images | grep codewind;