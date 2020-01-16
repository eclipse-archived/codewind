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
PERFORMANCE=performance;
KEYCLOAK=keycloak;
GATEKEEPER=gatekeeper;
ARCH=`uname -m`;
TAG=latest;
REGISTRY=eclipse

# On intel, uname -m returns "x86_64", but the convention for our docker images is "amd64"
if [ "$ARCH" == "x86_64" ]; then
  IMAGE_ARCH="amd64"
else
  IMAGE_ARCH=$ARCH
fi

ALL_IMAGES="$PFE $PERFORMANCE $KEYCLOAK $GATEKEEPER";

# Copy .env over to file-watcher
if [ -f $DIR/.env ]; then
  echo -e "\nCopying $DIR/.env to ${SRC_DIR}/${PFE}/file-watcher/scripts/.env\n"
  cp $DIR/.env ${SRC_DIR}/${PFE}/file-watcher/scripts/.env
fi

# Copy the license files to the portal, performance
cp -r $DIR/LICENSE ${SRC_DIR}/pfe/portal/
cp -r $DIR/NOTICE.md ${SRC_DIR}/pfe/portal/
cp -r $DIR/LICENSE ${SRC_DIR}/performance/
cp -r $DIR/NOTICE.md ${SRC_DIR}/performance/
cp -r $DIR/LICENSE ${SRC_DIR}/keycloak/
cp -r $DIR/NOTICE.md ${SRC_DIR}/keycloak/
cp -r $DIR/LICENSE ${SRC_DIR}/gatekeeper/
cp -r $DIR/NOTICE.md ${SRC_DIR}/gatekeeper/

# Copy the docs into portal
cp -r $DIR/docs ${SRC_DIR}/pfe/portal/

# Copy the appsody and odo extension into portal. The zip file must have a version number e.g. codewind-appsody-extension-0.3.0.zip
# in order for it to be accepted as a valid extension
echo -e "\n+++   DOWNLOADING EXTENSIONS   +++\n";
mkdir -p ${SRC_DIR}/pfe/extensions
rm -f ${SRC_DIR}/pfe/extensions/codewind-appsody-extension-*.zip
# In case of ARCH = ppc64le, do not download the zip file.
if [ "$ARCH" == "ppc64le" ]; then
   echo -e "\n+++++   DISABLING APPSODY EXTENSION FOR PPC64LE ARCHITECTURE +++++\n";
else
   curl -Lo ${SRC_DIR}/pfe/extensions/codewind-appsody-extension-9.9.9999.zip http://download.eclipse.org/codewind/codewind-appsody-extension/master/latest/codewind-appsody-extension-9.9.9999.zip
fi

rm -f ${SRC_DIR}/pfe/extensions/codewind-odo-extension-*.zip
curl -Lo ${SRC_DIR}/pfe/extensions/codewind-odo-extension-9.9.9999.zip http://download.eclipse.org/codewind/codewind-odo-extension/master/latest/codewind-odo-extension-9.9.9999.zip

# In case of ppc64le, download 'appsody' using ppc64le specific url and build 'appsody-controller' from source
if [ "$ARCH" == "ppc64le" ]; then
  $DIR/script/build-appsody-controller.sh
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
