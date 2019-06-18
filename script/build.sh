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

# When this script is called from CI/Travis, parameters are userid and password for artifactory
USERNAME=$1;
PASSWORD=$2;
DIR=`pwd`;
SRC_DIR=$DIR/src;
PFE=pfe
INITIALIZE=initialize
PERFORMANCE=performance;
ARCH=`uname -m`;
TAG=latest;

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
    # RELEASE CHANGES, change TRAVIS_BRANCH to point to branch to push to artifactory
    #
    # WORKAROUND: The build script is run multiple times on the same platform due to the current build matrix setup (portal and filewatcher are run using an environment variable).
    #             The images only need to be uploaded once. Ideally this can be controlled through Travis build stages however the current build system's Travis version
    #             does not support it so the UPLOAD_IMAGES check has been added as a workaround to ensure the image upload is only done once.
    #             Build stages are supported as of Travis Enterprise 2.2.0
    if [ "$UPLOAD_IMAGES" = "true" ] && [ "$TRAVIS_PULL_REQUEST" = "false" ] && [ "$TRAVIS_BRANCH" = "master" ]; then
      echo "+++   UPLOADING $IMAGE_NAME TO ARTIFACTORY   +++";
      cd ${DIR};
      # Upload images tagged by architecture.
      sudo ./script/upload.sh $IMAGE_NAME $USERNAME $PASSWORD $TRAVIS_COMMIT $TAG false;
      if [ $? -eq 0 ]; then
        sudo ./script/cleanup.sh $IMAGE_NAME $USERNAME $PASSWORD $TRAVIS_COMMIT;
      else
        echo "+++   FAILED TO PUSH $IMAGE_NAME TO ARTIFACTORY   +++"
        exit 12;
      fi
    fi
  else
    echo "+++   FAILED TO BUILD $IMAGE_NAME - exiting.   +++";
    exit 12;
  fi
done;
echo -e "\n+++   ALL DOCKER IMAGES SUCCESSFULLY BUILT   +++\n";
docker images | grep codewind;
