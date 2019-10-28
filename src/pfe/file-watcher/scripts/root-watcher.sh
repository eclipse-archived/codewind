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

# If running in Kubernetes, initialize helm
if [ "$IN_K8" == "true" ]; then

	# We are going to use a custom tiller in the namespace
	# because we do not have cluster role binding for our Che
	# workspace namespace and cannot access the cluster-scoped tiller
	echo "Initializing a custom helm tiller"
	helm init --upgrade --service-account $SERVICE_ACCOUNT_NAME

	# Copy the secret's config json file over
	echo "Copying the docker registry secrets over"
	if [ -e /tmp/secret/.dockerconfigjson ]; then
		mkdir -p /root/.docker/
		cp /tmp/secret/.dockerconfigjson /root/.docker/config.json
	elif [ -e /tmp/secret/.dockercfg ]; then
		cp /tmp/secret/.dockercfg /root/.dockercfg
	fi

	# Use a helm wrapper if TLS selected for helm
	if [[ "$USE_HELM_TLS" == "true" ]]; then
		echo "Creating Helm TLS wrapper"
		mv /usr/local/bin/helm /usr/local/bin/_helm
		cp /file-watcher/scripts/wrappers/helm_wrapper.sh /usr/local/bin/helm
		chmod +x /usr/local/bin/helm
	fi
fi
