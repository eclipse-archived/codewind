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

IMAGE=$1
IMAGE_NAME="$IMAGE"
USERNAME=$2
PASSWORD=$3
TRAVIS_COMMIT=$4
# RELEASE CHANGES, change RELEASE_TAG to be tag to push to artifactory i.e latest or 2018_M10
RELEASE_TAG=$5
IS_ARTIFACTORY=$6
ARTIFACTORY_URL=sys-mcs-docker-local.artifactory.swg-devops.com

#Remove local images
function delete() {
  docker rmi "${IMAGE_NAME}:latest"
  docker rmi "${ARTIFACTORY_URL}/${IMAGE_NAME}:$RELEASE_TAG"
  docker rmi "${ARTIFACTORY_URL}/${IMAGE_NAME}:$TRAVIS_COMMIT"
}

#Push the new Jenkins image to Artifactory
echo "$PASSWORD" | docker login ${ARTIFACTORY_URL} -u "$USERNAME" --password-stdin
if [ "$IS_ARTIFACTORY" = true ]; then
  IMAGE_NAME="${ARTIFACTORY_URL}/${IMAGE}"
fi
if ! docker tag "${IMAGE_NAME}:latest" "${ARTIFACTORY_URL}/${IMAGE_NAME}:$RELEASE_TAG"; then
  docker pull "${ARTIFACTORY_URL}/${IMAGE}:latest";
  docker tag "${ARTIFACTORY_URL}/${IMAGE}:latest" "${ARTIFACTORY_URL}/${IMAGE_NAME}:$RELEASE_TAG";
fi
docker push "${ARTIFACTORY_URL}/${IMAGE_NAME}:$RELEASE_TAG"
# also push the travis branch if specified
if [ -n "$TRAVIS_COMMIT" ]; then
  docker tag "${IMAGE_NAME}:latest" "${ARTIFACTORY_URL}/${IMAGE_NAME}:$TRAVIS_COMMIT"
  docker push "${ARTIFACTORY_URL}/${IMAGE_NAME}:$TRAVIS_COMMIT"
fi

# Clean up local images
# delete
