#!/bin/bash
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

projectDir=$1
imageName=$2
contextDir=$3

DOCKER_BUILD=docker.build
LOGFOLDER=$5

PROJECT_ID=$6
util=/file-watcher/scripts/util.sh

WORKSPACE=/codewind-workspace

# Ensure extended pattern matching is enabled
shopt -s extglob

# Copy the project folder contents to the current directory (.idc/docker/docker-xxx), overwrite if needed
cd $contextDir
cp -rf "$projectDir/." $contextDir

echo -e "Docker build log file "$WORKSPACE/.logs/$LOGFOLDER/$DOCKER_BUILD.log""

echo -e "Touching docker container build log file: "$WORKSPACE/.logs/$LOGFOLDER/$DOCKER_BUILD.log""
touch "$WORKSPACE/.logs/$LOGFOLDER/$DOCKER_BUILD.log"
echo -e "Triggering log file event for: docker container build log"
$util newLogFileAvailable $PROJECT_ID "build"

docker build -t $imageName -f Dockerfile-idc $contextDir |& tee "$WORKSPACE/.logs/$LOGFOLDER/$DOCKER_BUILD.log"
if [[ $? -ne 0 ]]; then
    rm -rf !(Dockerfile-idc|artifacts)
    exit 1
fi

# Delete the project files we copied over, make sure we don't delete Dockerfile-idc or the artifacts directory
rm -rf !(Dockerfile-idc|artifacts|target)
