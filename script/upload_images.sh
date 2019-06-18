#!/bin/bash
# When this script is called from CI/Travis, parameters are userid and password for artifactory
USERNAME=$1;
PASSWORD=$2;
TAG=$3;
IS_ARTIFACTORY=$4;
PERFORMANCE=performance;
PFE=pfe;
ALL_IMAGES_DEFAULT="$PFE $PERFORMANCE";
ALL_IMAGES=$5;
if [ -z "$ALL_IMAGES" ]; then
  ALL_IMAGES="$ALL_IMAGES_DEFAULT";
fi
ARCH=$(uname -m);

# BUILD IMAGES
# Uses a build file in each of the directories that we want to use
if [ "$TRAVIS_PULL_REQUEST" = "false" ] && [ "$TRAVIS_BRANCH" = "master" ]; then
  for image in $ALL_IMAGES
  do
    # RELEASE CHANGES, change TRAVIS_BRANCH to point to branch to push to artifactory
    echo "+++   UPLOADING $IMAGE_NAME TO ARTIFACTORY   +++";
    # Until we are ready to ship multi-arch images, upload x86_64 images as default with no
    # architecture set. Other public IBM images use amd64 instead of x86_64.
    if [ "$ARCH" == "x86_64" ]; then
      IMAGE_ARCH="amd64"
    else
      IMAGE_ARCH=$ARCH
    fi
    IMAGE_NAME=codewind-$image-$IMAGE_ARCH
    # Upload images tagged by architecture.
    if sudo ./script/upload.sh "$IMAGE_NAME" "$USERNAME" "$PASSWORD" "$TRAVIS_COMMIT" "$TAG" "$IS_ARTIFACTORY" -eq 0; then
      sudo ./script/cleanup.sh "$IMAGE_NAME" "$USERNAME" "$PASSWORD" "$TRAVIS_COMMIT";
    else
      echo "+++   FAILED TO PUSH $IMAGE_NAME TO ARTIFACTORY   +++"
      exit 12;
    fi
  done;
fi
docker images | grep codewind;
