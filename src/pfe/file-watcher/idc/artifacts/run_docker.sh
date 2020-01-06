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

if [ "$#" -lt 4 ]; then
	echo "* First argument should be the container name, the second should be the container id name, the third should be port mapping, the fourth is the idc docker base directory location"
 	exit 1
fi

export CONTAINER_NAME=$1

export CONTAINER_IMAGE_NAME=$2

export PORT_MAPPING_PARAMS="$3"

export IDC_APP_BASE=$4

export MICROCLIMATE_WS_ORIGIN=$5

export LOGFOLDER=$6

# The directory that contains this shell script (which is also the installation artifact/ dir)
export ARTIFACTS="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# App dir
export APPDIR=`pwd`
APP_DIRECTORY="$APPDIR"

export APPNAME=$(dirname "$APPDIR")

export LOGSDIR=$ARTIFACTS/.logs/"$LOGFOLDER"

# Need to set HOME var as this is run in fw, not inside app container
HOME=/home/default

docker stop $CONTAINER_NAME
docker rm $CONTAINER_NAME

if [[ $MICROCLIMATE_WS_ORIGIN &&  "$APPDIR" == '/codewind-workspace'* ]]
    then
		echo "Running codewind app container for "$APPDIR" using container name $CONTAINER_NAME";
		
		# The main MicroProfile directory is the parent of the codewind workspace
		MICROCLIMATE_ORIGIN_DIR=${MICROCLIMATE_WS_ORIGIN%'/codewind-workspace'}

		# The app directory is originally in the format /codewind-workspace/<app name>
		APPDIR=$MICROCLIMATE_ORIGIN_DIR"$APPDIR"
		echo "Application path used for volume mounting is: "$APPDIR""
		# The artifacts directory is in the main microprofile directory
		ARTIFACTS=$MICROCLIMATE_ORIGIN_DIR/docker/file-watcher/idc/artifacts

		LOGSDIR=$MICROCLIMATE_WS_ORIGIN/.logs/"$LOGFOLDER"
		echo "Log path used for volume mounting is: "$LOGSDIR""

		# on liberty the docker run checks for the output of the the command - check ContainerRunTask.java line 77 https://github.com/eclipse/codewind/blob/deebc7bdf94d8a27f8ff1756e7ba63c6030d87c8/src/pfe/iterative-dev/idc-java/IDC/src/org/eclipse/codewind/iterdev/tasks/ContainerRunTask.java#L77
		OUTPUT_DOCKER_RUN="$(docker run -dt --entrypoint "/home/default/artifacts/new_entrypoint.sh" --name $CONTAINER_NAME --network=codewind_network $PORT_MAPPING_PARAMS $CONTAINER_IMAGE_NAME)"
		if [ $? -eq 0 ]; then
			echo -e "Copying over source files"
			docker cp "$APP_DIRECTORY"/. $CONTAINER_NAME:$HOME/app
		fi
		echo "${OUTPUT_DOCKER_RUN}"

	else
		# on liberty the docker run checks for the output of the the command - check ContainerRunTask.java line 77 https://github.com/eclipse/codewind/blob/deebc7bdf94d8a27f8ff1756e7ba63c6030d87c8/src/pfe/iterative-dev/idc-java/IDC/src/org/eclipse/codewind/iterdev/tasks/ContainerRunTask.java#L77
		OUTPUT_DOCKER_RUN="$(docker run -dt --name $CONTAINER_NAME $PORT_MAPPING_PARAMS $CONTAINER_IMAGE_NAME)"
		if [ $? -eq 0 ]; then
			echo -e "Copying over source files"
			docker cp "$APP_DIRECTORY"/. $CONTAINER_NAME:$HOME/app
		fi
		echo "${OUTPUT_DOCKER_RUN}"
fi
