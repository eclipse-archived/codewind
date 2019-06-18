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
source /file-watcher/scripts/.env

if [ -f /file-watcher/server/.env ]; then
	source /file-watcher/server/.env
fi

echo "Creating workspace config directory"
mkdir -p /codewind-workspace/.config

echo "file-watcher container started $(date)"

LOCAL_WORKSPACE=$1
CONTAINER_WORKSPACE_DIRECTORY=$2

cache_liberty() {
	# We're force pulling the latest websphere liberty docker image here,
	# as a user can have an old cached image which may run on root.
	# Websphere Liberty has switched to non-root for their latest docker image.
	echo "Pulling the latest websphere-liberty:webProfile7 docker image";
	docker pull websphere-liberty:webProfile7
	# Pre-build the Liberty app image (Only on K8s, on local MC, Liberty app image is prebuilt in mcdev)
	if [ ! "$( docker images mc-liberty-jdk-cache -q )" ] && [ -f /file-watcher/dockerfiles/liberty/libertyDockerfile ]; then
		# Create the empty folders needed for the caching
		mkdir -p /file-watcher/dockerfiles/liberty/target/liberty/wlp/usr/servers/defaultServer
		mkdir -p /file-watcher/dockerfiles/liberty/target/liberty/wlp/usr/shared/resources

		echo "Pre-building the Liberty app image"
		$LIBERTY_BUILD_CMD
		if [ ! $? -eq 0 ]; then
			echo "Failed to build the liberty app image" >&2;
		else
			echo "Successfully built the docker image";
			docker tag mc-liberty-jdk-cache $DOCKER_REGISTRY/mc-liberty-jdk-cache
			docker push $DOCKER_REGISTRY/mc-liberty-jdk-cache
		fi
	fi
}

cache_spring() {
	# Pre-build the Spring app image (Only on K8s, on local MC, Liberty app image is prebuilt in mcdev)
	if [ ! "$( docker images mc-spring-jdk-cache -q )" ] && [ -f /file-watcher/dockerfiles/spring/springDockerfile ]; then
		echo "Pre-building the Spring app image"
		$SPRING_BUILD_CMD
		if [ ! $? -eq 0 ]; then
			echo "Failed to pre-build the Spring app image" >&2;
		else
			echo "Successfully pre-built the Spring app image";
			docker tag mc-spring-jdk-cache $DOCKER_REGISTRY/mc-spring-jdk-cache
			docker push $DOCKER_REGISTRY/mc-spring-jdk-cache
		fi
	fi
}

# Make sure the logs directory for build output exists.
mkdir -p $CONTAINER_WORKSPACE_DIRECTORY/.logs

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

	# Cache the liberty and spring images
	# cache_liberty > ./.logs/liberty_docker_cache.log 2>&1 &
	# cache_spring > ./.logs/spring_docker_cache.log 2>&1 &

	# Use a helm wrapper if TLS selected for helm
	if [[ "$USE_HELM_TLS" == "true" ]]; then
		echo "Creating Helm TLS wrapper"
		mv /usr/local/bin/helm /usr/local/bin/_helm
		cp /file-watcher/scripts/wrappers/helm_wrapper.sh /usr/local/bin/helm
		chmod +x /usr/local/bin/helm
	fi

	# Use a wrapper for kubectl if the user specified an alternate namespace
	if [[ $KUBE_NAMESPACE ]]; then
		echo "Creating kubectl wrapper"
		mv /usr/local/bin/kubectl /usr/local/bin/_kubectl
		cp /file-watcher/scripts/wrappers/kubectl_wrapper.sh /usr/local/bin/kubectl
		chmod +x /usr/local/bin/kubectl
	fi
fi

cd -
