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
source /file-watcher/scripts/constants.sh
source /file-watcher/scripts/.env

if [ -f /file-watcher/server/.env ]; then
	source /file-watcher/server/.env
fi

echo "Creating workspace config directory"
mkdir -p /codewind-workspace/.config
chmod -R g=rwx /codewind-workspace/.config/

echo "codewind-pfe container started $(date)"

LOCAL_WORKSPACE=$1
CONTAINER_WORKSPACE_DIRECTORY=$2

LIBERTY_BUILD_TEMPLATE="$IMAGE_COMMAND $BUILD_COMMAND -t liberty-app-cache -f"
LIBERTY_BUILD_CMD="$LIBERTY_BUILD_TEMPLATE /file-watcher/dockerfiles/liberty/libertyDockerfile /file-watcher/dockerfiles/liberty"
SPRING_BUILD_TEMPLATE="$IMAGE_COMMAND $BUILD_COMMAND -t spring-app-cache -f"
SPRING_BUILD_CMD="$SPRING_BUILD_TEMPLATE /file-watcher/dockerfiles/spring/springDockerfile /file-watcher/dockerfiles/spring"

cache_liberty() {
	# Pre-build the Liberty app image for local and remote case
	if [ ! "$( $IMAGE_COMMAND images liberty-app-cache -q )" ]; then
		if [ -f /file-watcher/dockerfiles/liberty/libertyDockerfile ]; then
			# Create the empty folders needed for the caching
			mkdir -p /file-watcher/dockerfiles/liberty/target/liberty/wlp/usr/servers/defaultServer
			chmod 775 /file-watcher/dockerfiles/liberty/target/liberty/wlp/usr/servers/defaultServer
			mkdir -p /file-watcher/dockerfiles/liberty/target/liberty/wlp/usr/shared/resources
			chmod 775 /file-watcher/dockerfiles/liberty/target/liberty/wlp/usr/shared/resources
			chmod 664 /file-watcher/dockerfiles/liberty/src/main/liberty/config/jvmbx.options

			echo "Pre-building the Liberty app image"
			$LIBERTY_BUILD_CMD
			if [ ! $? -eq 0 ]; then
				echo "Failed to pre-build the Liberty app image" >&2;
			else
				echo "Successfully pre-built the Liberty app image";
			fi
		else
			echo "Cannot pre-build the Liberty app image due to Dockerfile is missing"
		fi
	else
		echo "The Liberty app image already existed"
	fi
}

cache_spring() {
	# Pre-build the Spring app image for local and remote case
	if [ ! "$( $IMAGE_COMMAND images spring-app-cache -q )" ]; then
		if [ -f /file-watcher/dockerfiles/spring/springDockerfile ]; then
			echo "Pre-building the Spring app image"
			$SPRING_BUILD_CMD
			if [ ! $? -eq 0 ]; then
				echo "Failed to pre-build the Spring app image" >&2;
			else
				echo "Successfully pre-built the Spring app image";
			fi
		else
			echo "Cannot pre-build the Spring app image due to Dockerfile is missing"
		fi
	else
		echo "The Spring app image already existed"
	fi
}

# Make sure the logs directory for build output exists.
mkdir -p $CONTAINER_WORKSPACE_DIRECTORY/.logs

# Cache the liberty and spring images
cache_liberty > /codewind-workspace/.logs/liberty-app-cache.log 2>&1 &
cache_spring > /codewind-workspace/.logs/spring-app-cache.log 2>&1 &

# Create dir for docker config
echo "Creating /root/.docker/ for docker config"
mkdir -p /root/.docker/

# If running in Kubernetes, check if there is a registry secret to pull down
if [ "$IN_K8" == "true" ]; then

	# Check if there is a secret with labels app=codewind-pfe and codewindWorkspace=<workspace_id>
	# Create docker config from the secret if it exists, this is done to handle Pod restarts
	echo "Checking to see if a secret is present with labels app=codewind-pfe,codewindWorkspace="$CHE_WORKSPACE_ID
	SECRET=$( kubectl get secret --selector=app=codewind-pfe,codewindWorkspace=$CHE_WORKSPACE_ID )
	if [[ $SECRET = *$CHE_WORKSPACE_ID* ]]; then
		SECRET_NAME=$( kubectl get secret --selector=app=codewind-pfe,codewindWorkspace=$CHE_WORKSPACE_ID -o jsonpath="{.items[0].metadata.name}" )
		echo "A secret with the matching label has been found: $SECRET_NAME"
		echo "Creating the Codewind PFE Docker Config with the secret .dockerconfigjson data"
		kubectl get secret $SECRET_NAME -o jsonpath="{.data.\.dockerconfigjson}" | base64 --decode > /root/.docker/config.json
	fi
fi
