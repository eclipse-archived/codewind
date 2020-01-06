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

ROOT=$1
LOCAL_WORKSPACE=$2
PROJECT_ID=$3
COMMAND=$4
CONTAINER_NAME=$5
logName=$7
START_MODE=$8
DEBUG_PORT=$9
MAVEN_M2_CACHE=.m2/repository
FOLDER_NAME=${11}
IMAGE_PUSH_REGISTRY=${12}
MAVEN_SETTINGS=${13}

WORKSPACE=/codewind-workspace
LOG_FOLDER=$WORKSPACE/.logs/"$FOLDER_NAME"

DOCKER_BUILD_LOG=docker.build
MAVEN_BUILD=maven.build
APP_LOG=app

echo "*** JAVA"
echo "*** PWD = $PWD"
echo "*** ROOT = $ROOT"
echo "*** LOCAL_WORKSPACE = $LOCAL_WORKSPACE"
echo "*** PROJECT_ID = $PROJECT_ID"
echo "*** COMMAND = $COMMAND"
echo "*** CONTAINER_NAME = $CONTAINER_NAME"
echo "*** START_MODE = $START_MODE"
echo "*** DEBUG_PORT = $DEBUG_PORT"
echo "*** FOLDER_NAME = $FOLDER_NAME"
echo "*** LOG_FOLDER = $LOG_FOLDER"
echo "*** IMAGE_PUSH_REGISTRY = $IMAGE_PUSH_REGISTRY"
echo "*** MAVEN_SETTINGS = $MAVEN_SETTINGS"


# Import general constants
source /file-watcher/scripts/constants.sh

tag=microclimate-dev-spring
projectName=$( basename "$ROOT" )
project=$CONTAINER_NAME
util=/file-watcher/scripts/util.sh
cacheUtil=/file-watcher/scripts/cache-util.sh

# Constants for the cache util
dockerfile=Dockerfile
dockerfileKey=DOCKERFILE_HASH
dockerfileBuild=Dockerfile-build
dockerfileBuildKey=DOCKERFILE_BUILD_HASH
chartDir=chart
chartDirKey=CHARTDIRECTORY_HASH

echo project=$project
cd "$ROOT"

set -o pipefail

function create() {
	# Fix to stop file-watcher from attempting the rebuild procedure
	STOP_WATCHING_CHECK="$ROOT/codewind-stop-watching-flag";
	echo $STOP_WATCHING_CHECK;
	if [ -f "$STOP_WATCHING_CHECK" ]; then
		echo "Stop watching flag found. Doing nothing.";
	else
		# If the maven m2 cache doesn't exist then pull it from dockerhub
		if [ ! -d $MAVEN_M2_CACHE ]; then
			if [ "$IN_K8" == "true" ]; then
				echo "Pulling maven m2 cache image for $ROOT using buildah"
				buildah pull ibmcom/codewind-java-project-cache > /dev/null
				dockerPullExitCode=$?

				if [ $dockerPullExitCode -eq 0 ]; then
					echo "Finished pulling maven m2 cache image for $ROOT using buildah"
					echo "Maven m2 cache will be used for spring project $ROOT"
					buildah from ibmcom/codewind-java-project-cache
					CACHE_CONTAINER_ID=$(buildah ps | grep codewind-java-project-cache | cut -d " " -f 1)
					mnt=$(buildah mount $CACHE_CONTAINER_ID)

					echo "Downloading maven m2 cache to $ROOT"		
					cp $mnt/cache/localm2cache.zip .
					buildah rm $CACHE_CONTAINER_ID
					echo "Finished downloading maven m2 cache to $ROOT"
				else
					echo "Maven m2 cache cannot be retrieved for spring project $ROOT because the cache image could not be pulled using buildah"
				fi
			else
				echo "Pulling maven m2 cache image for $ROOT using docker"
				docker pull ibmcom/codewind-java-project-cache > /dev/null
				dockerPullExitCode=$?

				if [ $dockerPullExitCode -eq 0 ]; then
					echo "Finished pulling cache image for $ROOT using docker"
					echo "Cache will be used for spring project $ROOT"
					CACHE_CONTAINER_ID=$(docker create ibmcom/codewind-java-project-cache)
					echo "Downloading maven m2 cache to $ROOT"
					docker cp $CACHE_CONTAINER_ID:/cache/localm2cache.zip .
					echo "Finished downloading maven m2 cache to $ROOT"	
					docker rm -f $CACHE_CONTAINER_ID
				else
					echo "Maven m2 cache cannot be retrieved for spring project $ROOT because the cache image could not be pulled using docker"
				fi
			fi
		fi

		if [ "$IN_K8" == "true" ]; then
			deployK8
		else
			deployLocal
		fi
	fi
}

function deployK8() {
	# Find the Helm chart folder, error out if it can't be found
	if [[ -d "chart/$projectName" ]] && [[ -f "chart/$projectName/Chart.yaml" ]]; then
		chartDir="chart/$projectName"
	else
		chartDir="$(find . -type f -name '*Chart.yaml*' | sed -r 's|/[^/]+$||' | sort | uniq | head -n1)"
		if [[ ! -d "$chartDir" ]]; then
			echo "Exiting, unable to find the Helm chart for project $projectName"
			$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.noHelmChart"
			exit 3
		fi
	fi
	chartName=$( basename $chartDir )
	tmpChart=/tmp/$projectName/$chartName

	# Copy the chart to a temp location and make sure it doesn't exist already.
	if [[ -d $tmpChart ]]; then
		rm -rf $tmpChart
	fi
	mkdir -p $tmpChart
	cp -fR $chartDir/* $tmpChart
	parentDir=$( dirname $tmpChart )

	# Render the chart template
	helm template $project $tmpChart \
		--values=/file-watcher/scripts/override-values.yaml \
		--set image.repository=$IMAGE_PUSH_REGISTRY/$project \
		--output-dir=$parentDir

	# Get the Deployment and Service file
	deploymentFile=$( /file-watcher/scripts/kubeScripts/find-kube-resource.sh $tmpChart Deployment )
	if [[ -z $deploymentFile ]]; then
		echo "Error, unable to find a deployment file in the Helm chart."
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.noDeployment"
	fi
	serviceFile=$( /file-watcher/scripts/kubeScripts/find-kube-resource.sh $tmpChart Service )
	if [[ -z $serviceFile ]]; then
		echo "Error, unable to find a service file in the Helm chart."
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.noService"
	fi

	# Add the necessary labels and serviceaccount to the chart
	/file-watcher/scripts/kubeScripts/modify-helm-chart.sh $deploymentFile $serviceFile $project $PROJECT_ID

	# Add the iterative-dev functionality to the chart
	/file-watcher/scripts/kubeScripts/add-iterdev-to-chart.sh $deploymentFile "$projectName" "/scripts/new_entrypoint.sh"

	# Push app container image to docker registry if one is set up
	if [[ ! -z $IMAGE_PUSH_REGISTRY ]]; then
		# If there's an existing failed Helm release, delete it. See https://github.com/helm/helm/issues/3353
		if [ "$( helm list --failed -q | grep $project )" ]; then
			$util updateAppState $PROJECT_ID $APP_STATE_STOPPING
			helm delete $project
		fi

		# Build the docker image for the project
		modifyDockerfileAndBuild

		# Tag and push the image to the registry
		$IMAGE_COMMAND push --tls-verify=false $project $IMAGE_PUSH_REGISTRY/$project

		if [ $? -eq 0 ]; then
			echo "Successfully tagged and pushed the application image $IMAGE_PUSH_REGISTRY/$project"
		else
			echo "Error: $?, could not push application image $IMAGE_PUSH_REGISTRY/$project" >&2
			$util imagePushRegistryStatus $PROJECT_ID "buildscripts.invalidImagePushRegistry"
			$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.invalidImagePushRegistry"
			exit 3
		fi

		helm upgrade $project $tmpChart \
			--install  \
			--recreate-pods
	else
		# Build the docker image
		modifyDockerfileAndBuild

		# Install the image using Helm
		helm upgrade $project $tmpChart \
			--install  \
			--recreate-pods
	fi

	if [ $? -eq 0 ]; then
		echo "Helm install successful for $projectName"
		# The application still needs to be built so don't send a build success event
	else
		echo "Helm install failed for $projectName with exit code $?, exiting" >&2
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
		exit 3
	fi

	# Wait until the pod is up and running
	POD_RUNNING=0
	while [ $POD_RUNNING -eq 0 ]; do
		RESULT="$( kubectl get po --selector=release=$project )"
		if [[ $RESULT = *"Running"* ]]; then
			POD_RUNNING=1
		elif [[ -z "$RESULT" || $RESULT = *"Failure"* || $RESULT = *"Unknown"* || $RESULT = *"ImagePullBackOff"* || $RESULT = *"CrashLoopBackOff"* ]]; then
			echo "Error: Pod for Helm release $project failed to start" >&2
			errorMsg="Error starting project $projectName: pod for helm release $project failed to start"  # :NLS
			$util updateAppState $PROJECT_ID $APP_STATE_STOPPING

			# Print the Helm status before deleting the release
			helm status $project

			helm delete $project
			$util updateAppState $PROJECT_ID $APP_STATE_STOPPED "$errorMsg"
			exit 3
		fi
		sleep 1;
	done

	echo "The pod for helm release $project is now up"

	# Delete any pods for the project left that are terminating, to ensure they go away
	/file-watcher/scripts/kubeScripts/clear-terminating-pods.sh $project

	# Build the spring application
	runMavenBuild

	# Start the Spring application in the correct mode
	start

	echo -e "Touching application log file: "$LOG_FOLDER/$APP_LOG.log""
	touch "$LOG_FOLDER/$APP_LOG.log"
	echo -e "Triggering log file event for: application log"
 	$util newLogFileAvailable $PROJECT_ID "app"

	# add the app logs
	echo -e "App log file "$LOG_FOLDER/$APP_LOG.log""
	kubectl logs -f $(kubectl get po -o name --selector=release=$project) >> "$LOG_FOLDER/$APP_LOG.log" &
}

function dockerRun() {
	workspace=`$util getWorkspacePathForVolumeMounting $LOCAL_WORKSPACE`
	echo "Workspace path used for volume mounting is: "$workspace""

	# Remove container if it already exists (could be from a failed attempt)
	if [ "$($IMAGE_COMMAND ps -aq -f name=$project)" ]; then
		$IMAGE_COMMAND rm -f $project
	fi

	$IMAGE_COMMAND run --network=codewind_network \
		--entrypoint "/scripts/new_entrypoint.sh" \
		--name $project \
		--expose 8080 -p 127.0.0.1::$DEBUG_PORT -P -dt $project
	if [ $? -eq 0 ]; then
		echo -e "Copying over source files"
		docker cp "$WORKSPACE/$projectName"/. $project:/root/app
	fi

}

function deployLocal() {
	if [ "$( $IMAGE_COMMAND ps -q -f name=$project )" ]; then
		echo "Stopping existing container"
		$util updateAppState $PROJECT_ID $APP_STATE_STOPPING
		$IMAGE_COMMAND kill $($IMAGE_COMMAND ps -q -f name=$project)
	fi

	if [ "$( $IMAGE_COMMAND ps -qa -f name=$project )" ]; then
		echo "Removing an old container before trying to build a new one"
		$IMAGE_COMMAND rm -f $project
		$IMAGE_COMMAND rmi -f $project
	fi

	modifyDockerfileAndBuild

	dockerRun

	DOCKER_RUN_RC=$?
	if [ $DOCKER_RUN_RC -eq 0 ]; then
		echo "Start container stage succeeded for $project"
	else
		# Docker run can sometimes inexplicably fail with the following error:
		#   docker: Error response from daemon: driver failed programming external connectivity
		#   on endpoint <project>: Error starting userland proxy: listen tcp 0.0.0.0:43273: bind: address already in use.
		#
		# Workaround: Retry once if we hit this error.
		echo "Start container stage failed for $project with exit code $DOCKER_RUN_RC" >&2
		echo "Retrying start container stage"
		dockerRun
		DOCKER_RUN_RC=$?
		if [ $DOCKER_RUN_RC -ne 0 ]; then
			echo "Start container stage failed for $project with exit code $DOCKER_RUN_RC" >&2
			$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
			exit 3
		fi
	fi

	# Build the Spring application
	runMavenBuild

	# Start the Spring application in the correct mode
	start

	echo -e "Touching application log file: "$LOG_FOLDER/$APP_LOG.log""
	touch "$LOG_FOLDER/$APP_LOG.log"
	echo -e "Triggering log file event for: application log"
 	$util newLogFileAvailable $PROJECT_ID "app"

	# add the app logs
	echo -e "App log file $LOG_FOLDER/$APP_LOG.log"
	$IMAGE_COMMAND logs -f $CONTAINER_NAME >> "$LOG_FOLDER/$APP_LOG.log" &
}
function initCache() {
	# Init the cache of file hashes for the project
	# Currently just the dockerfile hash and the chart dir hash
	echo "Initializing cache for: $projectName"
	dockerfileHash=$(sha256sum $dockerfile)
	dockerfileBuildHash=$(sha256sum $dockerfileBuild)
	$cacheUtil "$PROJECT_ID" update $dockerfileKey "$dockerfileHash" $dockerfileBuildKey "$dockerfileBuildHash"
	if [ "$IN_K8" == "true" ]; then
		chartDirHash=$(find $chartDir -type f -name "*.yaml" -exec sha256sum {} + | awk '{print $1}' | sort | sha256sum)
		$cacheUtil "$PROJECT_ID" update $chartDirKey "$chartDirHash"
	fi
}

function runMavenBuild() {
	# Execute spring-build.sh script for maven build
	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.buildMaven"
	if [[ "$IN_K8" == "true" ]]; then
		POD_NAME="$( kubectl get po --selector=release=$project | grep 'Running' | cut -d ' ' -f 1 )"

		# before running the spring build, we should touch the maven build file and call the logs api to emit its availability
		echo -e "Touching maven build log file: "/root/logs/$MAVEN_BUILD.log""
		kubectl exec $POD_NAME -- bash -c "touch "/root/logs/$MAVEN_BUILD.log""
		
		echo -e "Triggering log file event for: maven build log"
  		$util newLogFileAvailable $PROJECT_ID "build"
		
		kubectl exec $POD_NAME -- bash "/scripts/spring-build.sh" $logName "$projectName" "$FOLDER_NAME" "$MAVEN_SETTINGS"
		exit_code=$?
	else
		# before running the spring build, we should touch the maven build file and call the logs api to emit its availability
		echo -e "Touching maven build log file: "/root/logs/$MAVEN_BUILD.log""
		$IMAGE_COMMAND exec $project bash -c "touch "/root/logs/$MAVEN_BUILD.log""
		
		echo -e "Triggering log file event for: maven build log"
  		$util newLogFileAvailable $PROJECT_ID "build"

		$IMAGE_COMMAND exec $project /scripts/spring-build.sh $logName "$projectName" "$FOLDER_NAME" "$MAVEN_SETTINGS"
		exit_code=$?
	fi

	if [ $exit_code -eq 0 ]; then
		$util updateBuildState $PROJECT_ID $BUILD_STATE_SUCCESS " "
	else
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildMavenFail"
		exit 3
	fi
}

function update() {
	# On Spring project update, we only want to exec into the container and run a maven build
	echo "logName: $logName"
	echo "folderName: $FOLDER_NAME"
	echo "projectName: $projectName"

	# Update the spring jar
	$util updateAppState $PROJECT_ID $APP_STATE_STOPPING

	runMavenBuild

	# Start the Spring application in the correct mode
	start
}

function start() {
	# Start the spring application

	if [[ "$IN_K8" == "true" ]]; then
		# Debug not supported on Kubernetes
		echo "Starting the $projectName project in run mode"
		POD_NAME="$( kubectl get po --selector=release=$project | grep 'Running' | cut -d ' ' -f 1 )"
		kubectl exec $POD_NAME bash "/scripts/spring-start.sh" "$projectName" run
		exit_code=$?
	else
		echo "Starting the $projectName project in $START_MODE mode"
		$IMAGE_COMMAND exec $project /scripts/spring-start.sh "$projectName" $START_MODE $DEBUG_PORT
		exit_code=$?
	fi

	if [ $exit_code -eq 0 ]; then
		$util updateAppState $PROJECT_ID $APP_STATE_STARTING
	else
		echo "Project start failed for: $projectName"
		errorMsg="Application $projectName failed to start"
		$util updateAppState $PROJECT_ID $APP_STATE_STOPPED "$errorMsg"
		exit 3
	fi
}

function stop() {
	# Stop the spring application
	echo "Stopping the $projectName project"

	if [[ "$IN_K8" == "true" ]]; then
		POD_NAME="$( kubectl get po --selector=release=$project | grep 'Running' | cut -d ' ' -f 1 )"
		kubectl exec $POD_NAME bash "/scripts/spring-stop.sh" "$projectName"
		exit_code=$?
	else
		$IMAGE_COMMAND exec $project /scripts/spring-stop.sh "$projectName"
		exit_code=$?
	fi

	if [ $exit_code -eq 0 ]; then
		$util updateAppState $PROJECT_ID $APP_STATE_STOPPING
	else
		echo "Project stop failed for: $projectName"
		exit 3
	fi
}

function modifyDockerfileAndBuild() {
	# Copy contents of the app dir to a temp folder
	mkdir -p /tmp/$project-build
	cp -rf * /tmp/$project-build

	# Copy the spring scripts we need over
	cp -rf /file-watcher/scripts/springScripts/. /tmp/$project-build/scripts

	cd /tmp/$project-build

	# Remove any references to the not-yet built spring jar from the dockerfile (otherwise, those commands will fail since the app hasn't been built yet)
	sed -i '/-SNAPSHOT.jar/d' Dockerfile

	# Construct the dockerfile to build the app image
	cat Dockerfile Dockerfile-build scripts/Dockerfile-dev-setup-spring > Dockerfile-$project

	# Build the docker image
	echo "$BUILD_IMAGE_INPROGRESS_MSG $projectName"
	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.buildImage"

	echo -e "Touching docker container build log file: "$LOG_FOLDER/$DOCKER_BUILD_LOG.log""
	touch "$LOG_FOLDER/$DOCKER_BUILD_LOG.log"
	echo -e "Triggering log file event for: docker container build log"
 	$util newLogFileAvailable $PROJECT_ID "build"

	echo -e "Docker build log file "$LOG_FOLDER/$DOCKER_BUILD_LOG.log""
	$IMAGE_COMMAND $BUILD_COMMAND -t $project -f Dockerfile-$project /tmp/$project-build |& tee "$LOG_FOLDER/$DOCKER_BUILD_LOG.log"
	exitCode=$?
	
	# The last image build timestamp
	imageLastBuild=$(($(date +%s)*1000))
	if [ $exitCode -eq 0 ]; then
		echo "$BUILD_IMAGE_SUCCESS_MSG $projectName"
		# The application still needs to be built so don't send a build success event
		$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.containerBuildSuccess" "$imageLastBuild"
	else
		echo "$BUILD_IMAGE_FAILED_MSG $projectName" >&2
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
		exit 3
	fi

	cd "$ROOT"
	rm -rf /tmp/$project-build
}
# Create the application image and container and start it
if [ "$COMMAND" == "create" ]; then
	# Set the initial state to stopped
	$util updateAppState $PROJECT_ID $APP_STATE_STOPPED

	# Copy over the Dockerfile-build if one doesn't already exist
	if [[ ! -f "$ROOT/Dockerfile-build" ]]; then
		cp /file-watcher/dockerfiles/Dockerfile-jdk-maven "$ROOT/Dockerfile-build"
	fi

	# Init the cache containing the hashes of select files
	initCache

    create

# Update the application
elif [ "$COMMAND" == "update" ]; then
	# Get the current hash of the docker file and chart dir
	dockerfileHash=$(sha256sum $dockerfile)
	dockerfileBuildHash=$(sha256sum $dockerfileBuild)
	changedList=`$cacheUtil "$PROJECT_ID" getChanged $dockerfileKey "$dockerfileHash" $dockerfileBuildKey "$dockerfileBuildHash"`
	if [ "$IN_K8" == "true" ]; then
		chartDirHash=$(find $chartDir -type f -name "*.yaml" -exec sha256sum {} + | awk '{print $1}' | sort | sha256sum)
		changedListK8=`$cacheUtil "$PROJECT_ID" getChanged $chartDirKey "$chartDirHash"`
		changedList+=("${changedListK8[@]}")
	fi
	action=NONE
	for item in ${changedList[@]}; do
		echo "$item changed"
		if [[ "$item" == "$dockerfileKey" ]] || [[ "$item" == "$dockerfileBuildKey" ]] || [[ "$item" == "$chartDirKey" ]]; then
			action=REBUILD
			break
		fi
	done
	if [ "$action" == "REBUILD" ]; then
		create
	else
		update
	fi
# Stop the application
elif [ "$COMMAND" == "stop" ]; then
	echo "Stopping spring application: $projectName"
	stop
# Start the application
elif [ "$COMMAND" == "start" ]; then
	echo "Starting spring application: $projectName"
	start
# Remove the application
elif [ "$COMMAND" == "remove" ]; then
	echo "Removing the container and image for app $ROOT."

	if [ "$IN_K8" == "true" ]; then
		echo "Killing app log process"
		pgrep -f "kubectl logs -f" | xargs kill -9

		helm delete $project

	else
		# Remove container
		if [ "$($IMAGE_COMMAND ps -aq -f name=$project)" ]; then
			$IMAGE_COMMAND rm -f $project
		fi
	fi

	# Remove image
	if [ "$($IMAGE_COMMAND images -qa -f reference=$project)" ]; then
		$IMAGE_COMMAND rmi -f $project
	fi
else
	echo "ERROR: $COMMAND is not a recognized command" >&2
fi
cd "$ROOT"
