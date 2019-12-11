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
AUTO_BUILD_ENABLED=$6
LOGNAME=$7
START_MODE=$8
DEBUG_PORT=$9
FORCE_ACTION=${10}
FOLDER_NAME=${11}
IMAGE_PUSH_REGISTRY=${12}

WORKSPACE=/codewind-workspace

DOCKER_BUILD=docker.build
APP_LOG=app

LOG_FOLDER=$WORKSPACE/.logs/$FOLDER_NAME

echo "*** NODE.JS"
echo "*** PWD = $PWD"
echo "*** ROOT = $ROOT"
echo "*** LOCAL_WORKSPACE = $LOCAL_WORKSPACE"
echo "*** PROJECT_ID = $PROJECT_ID"
echo "*** COMMAND = $COMMAND"
echo "*** CONTAINER_NAME = $CONTAINER_NAME"
echo "*** AUTO_BUILD_ENABLED = $AUTO_BUILD_ENABLED"
echo "*** LOGNAME = $LOGNAME"
echo "*** START_MODE = $START_MODE"
echo "*** DEBUG_PORT = $DEBUG_PORT"
echo "*** FORCE_ACTION = $FORCE_ACTION"
echo "*** LOG_FOLDER = $LOG_FOLDER"
echo "*** IMAGE_PUSH_REGISTRY = $IMAGE_PUSH_REGISTRY"
echo "*** HOST_OS = $HOST_OS"

tag=microclimate-dev-nodejs
projectName=$( basename "$ROOT" )
project=$CONTAINER_NAME

# Cache constants
dockerfile=Dockerfile
dockerfileKey=DOCKERFILE_HASH
dockerfileTools=Dockerfile-tools
dockerfileToolsKey=DOCKERFILE_TOOLS_HASH
packageJson=package.json
packageJsonKey=PACKAGE_JSON_HASH
nodemonJson=nodemon.json
nodemonJsonKey=NODEMON_JSON_HASH
chartDir=chart
chartDirKey=CHARTDIRECTORY_HASH
cacheUtil=/file-watcher/scripts/cache-util.sh
util=/file-watcher/scripts/util.sh

#Import general constants
source /file-watcher/scripts/constants.sh

echo project=$project
cd "$ROOT"

set -o pipefail

function cleanContainer() {
	if [ "$IN_K8" != "true" ]; then
		if [ "$($IMAGE_COMMAND ps -aq -f name=$project)" ]; then
			$util updateAppState $PROJECT_ID $APP_STATE_STOPPING
			$IMAGE_COMMAND rm -f $project
			$IMAGE_COMMAND rmi -f $project
		fi
	fi
}

function create() {
	# Run the project using either helm or docker run
	if [ "$IN_K8" == "true" ]; then
		deployK8s
	else
		deployLocal
	fi
}

function deployK8s() {
	# Find the Helm chart folder, error out if it can't be found
	if [[ -d "chart/$projectName" ]] && [[ -f "chart/$projectName/Chart.yaml" ]]; then
		chartDir="chart/$projectName"
	else
		chartDir="$(find . -type f -name '*Chart.yaml*' | sed -r 's|/[^/]+$||' | sort | uniq | head -n1)"
		if [[ ! -d "$chartDir" ]]; then
			echo "Exiting, Unable to find the Helm chart for project $projectName"
			$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.noHelmChart"
			exit 3
		fi
	fi
	chartName=$( basename $chartDir )
	tmpChart=/tmp/$projectName/$chartName

	# Copy project chart dir to a tmp location for chart modify and helm install
	echo "Copying chart dir $chartDir to $tmpChart"
	if [[ -d $tmpChart ]]; then
		rm -rf $tmpChart
	fi
	mkdir -p $tmpChart
	cp -fR $chartDir/* $tmpChart
	parentDir=$( dirname $tmpChart )

	echo "Modifying charts and running Helm install from $chartDir"

	# Render the template yamls for the chart
	helm template $project $tmpChart \
		--values=/file-watcher/scripts/override-values.yaml \
		--set image.repository=$IMAGE_PUSH_REGISTRY/$project \
		--output-dir=$parentDir

	deploymentFile=$( /file-watcher/scripts/kubeScripts/find-kube-resource.sh $tmpChart Deployment )
	if [[ -z $deploymentFile ]]; then
		echo "Error, unable to find a deployment file in the Helm chart."
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.noDeployment"
		exit 3
	fi
	serviceFile=$( /file-watcher/scripts/kubeScripts/find-kube-resource.sh $tmpChart Service )
	if [[ -z $serviceFile ]]; then
		echo "Error, unable to find a service file in the Helm chart."
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.noService"
		exit 3
	fi

	# Add the necessary labels and serviceaccount to the chart
	/file-watcher/scripts/kubeScripts/modify-helm-chart.sh $deploymentFile $serviceFile $project $PROJECT_ID

	# Push app container image to docker registry if one is set up
	if [[ ! -z $IMAGE_PUSH_REGISTRY ]]; then
		# If there's an existing failed Helm release, delete it. See https://github.com/helm/helm/issues/3353
		if [ "$( helm list --failed -q | grep $project )" ]; then
			$util updateAppState $PROJECT_ID $APP_STATE_STOPPING
			helm delete $project
		fi

		echo "$BUILD_IMAGE_INPROGRESS_MSG $projectName"
		$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.buildImage"

		echo -e "Touching docker container build log file: "$LOG_FOLDER/$DOCKER_BUILD.log""
		touch "$LOG_FOLDER/$DOCKER_BUILD.log"
		echo -e "Triggering log file event for: docker container build log"
 		$util newLogFileAvailable $PROJECT_ID "build"

		echo -e "Docker build log file "$LOG_FOLDER/$DOCKER_BUILD.log""
		$IMAGE_COMMAND $BUILD_COMMAND -t $project . |& tee "$LOG_FOLDER/$DOCKER_BUILD.log"
		exitCode=$?
		imageLastBuild=$(($(date +%s)*1000))
		if [ $exitCode -eq 0 ]; then
			echo "Docker build successful for $projectName"
			$util updateBuildState $PROJECT_ID $BUILD_STATE_SUCCESS " " "$imageLastBuild"
		else
			echo "$BUILD_IMAGE_FAILED_MSG $projectName" >&2
			$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
			exit 3
		fi

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

		# Install the application using helm.
		helm upgrade $project $tmpChart \
			--install \
			--recreate-pods
	else
		echo "$BUILD_IMAGE_INPROGRESS_MSG $projectName"
		$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.buildImage"

		echo -e "Touching docker container build log file: "$LOG_FOLDER/$DOCKER_BUILD.log""
		touch "$LOG_FOLDER/$DOCKER_BUILD.log"
		echo -e "Triggering log file event for: docker container build log"
 		$util newLogFileAvailable $PROJECT_ID "build"

		echo -e "Docker build log file "$LOG_FOLDER/$DOCKER_BUILD.log""
		$IMAGE_COMMAND $BUILD_COMMAND -t $project . |& tee "$LOG_FOLDER/$DOCKER_BUILD.log"
		exitCode=$?
		imageLastBuild=$(($(date +%s)*1000))
		if [ $exitCode -eq 0 ]; then
			echo "Docker build successful for $projectName"
			$util updateBuildState $PROJECT_ID $BUILD_STATE_SUCCESS " " "$imageLastBuild"
		else
			echo "$BUILD_IMAGE_FAILED_MSG $projectName" >&2
			$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
			exit 3
		fi
		helm upgrade $project $tmpChart \
			--install $project \
			--recreate-pods
	fi

	if [ $? -eq 0 ]; then
		echo "Helm install successful for $projectName"
		$util updateBuildState $PROJECT_ID $BUILD_STATE_SUCCESS " "
		$util updateAppState $PROJECT_ID $APP_STATE_STARTING
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

			# Print the Helm status before deleting the release
			helm status $project

			helm delete $project

			$util updateAppState $PROJECT_ID $APP_STATE_STOPPED "$errorMsg"
			exit 3
		fi
		sleep 1;
	done

	echo "The pod for helm release $project is now up"

	# Delete any pods left that are terminating, to ensure they go away
	/file-watcher/scripts/kubeScripts/clear-terminating-pods.sh $project

	echo -e "Touching application log file: "$LOG_FOLDER/$APP_LOG.log""
	touch "$LOG_FOLDER/$APP_LOG.log"
	echo -e "Triggering log file event for: application log"
 	$util newLogFileAvailable $PROJECT_ID "app"

	# add the app logs
	echo -e "App log file "$LOG_FOLDER/$APP_LOG.log""
	kubectl logs -f $(kubectl get po -o name --selector=release=$project) >> "$LOG_FOLDER/$APP_LOG.log" &
}

function dockerRun() {
	# Map container to different port than the project is using
	dockerCmd="tail -F /output/container.log 2>/dev/null"
	# The NODE_HEAPDUMP_OPTIONS=nosignal environment variable is needed for nodemon to work due to the common use of SIGUSR2 between nodemon and appmetrics. See https://github.com/RuntimeTools/appmetrics/issues/517 for details
	heapdump="NODE_HEAPDUMP_OPTIONS=nosignal"

	# Remove container if it already exists (could be from a failed attempt)
	if [ "$($IMAGE_COMMAND ps -aq -f name=$project)" ]; then
		$IMAGE_COMMAND rm -f $project
	fi

	workspace=`$util getWorkspacePathForVolumeMounting $LOCAL_WORKSPACE`
	echo "Workspace path used for volume mounting is: "$workspace""

	$IMAGE_COMMAND run --network=codewind_network -e $heapdump --name $project -p 127.0.0.1::$DEBUG_PORT -P -dt $project /bin/bash -c "$dockerCmd";
	if [ $? -eq 0 ]; then
		echo -e "Copying over source files"
		docker cp "$WORKSPACE/$projectName/." $project:/app
	fi

}

function deployLocal() {
	echo "$BUILD_IMAGE_INPROGRESS_MSG $projectName"
	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.buildImage"

	echo -e "Touching docker container build log file: "$LOG_FOLDER/$DOCKER_BUILD.log""
	touch "$LOG_FOLDER/$DOCKER_BUILD.log"
	echo -e "Triggering log file event for: docker container build log"
 	$util newLogFileAvailable $PROJECT_ID "build"

	echo -e "Docker build log file "$LOG_FOLDER/$DOCKER_BUILD.log""
	$IMAGE_COMMAND $BUILD_COMMAND -t $project . |& tee "$LOG_FOLDER/$DOCKER_BUILD.log"

	exitCode=$?
	imageLastBuild=$(($(date +%s)*1000))
	if [ $exitCode -eq 0 ]; then
		echo "$BUILD_IMAGE_SUCCESS_MSG $projectName"
	else
		echo "$BUILD_IMAGE_FAILED_MSG $projectName" >&2
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
		exit 3
	fi

	echo "$project container does not exist. Starting container for $project..."
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
			$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
			exit 3
		fi
	fi

	$IMAGE_COMMAND cp /file-watcher/scripts/nodejsScripts $project:/scripts
	$IMAGE_COMMAND exec $project /scripts/noderun.sh start $AUTO_BUILD_ENABLED $START_MODE $HOST_OS
	if [ $? -eq 0 ]; then
		# The build is now complete so send a success event
		$util updateBuildState $PROJECT_ID $BUILD_STATE_SUCCESS " " "$imageLastBuild"
		$util updateAppState $PROJECT_ID $APP_STATE_STARTING
	else
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
		exit 3
	fi

	echo -e "Touching application log file: "$LOG_FOLDER/$APP_LOG.log""
	touch "$LOG_FOLDER/$APP_LOG.log"
	echo -e "Triggering log file event for: application log"
 	$util newLogFileAvailable $PROJECT_ID "app"

	# add the app logs
	echo -e "App log file "$LOG_FOLDER/$APP_LOG.log""
	$IMAGE_COMMAND logs -f $CONTAINER_NAME >> "$LOG_FOLDER/$APP_LOG.log" &
}

# Initialize the cache with the hash for select files.  Called from project-watcher.
function initCache() {
	# Cache the hash codes for main files
	echo "Initializing cache for: $projectName"
	dockerfileHash=$(sha256sum $dockerfile)
	dockerfileToolsHash=$(sha256sum $dockerfileTools)
	packageJsonHash=$(sha256sum $packageJson)
	nodemonJsonHash=$(sha256sum $nodemonJson)
	$cacheUtil "$PROJECT_ID" update $dockerfileKey "$dockerfileHash" $dockerfileToolsKey "$dockerfileToolsHash" $packageJsonKey "$packageJsonHash" $nodemonJsonKey "$nodemonJsonHash"
	if [ "$IN_K8" == "true" ]; then
		chartDirHash=$(find $chartDir -type f -name "*.yaml" -exec sha256sum {} + | awk '{print $1}' | sort | sha256sum)
		$cacheUtil "$PROJECT_ID" update $chartDirKey "$chartDirHash"
	fi
}

# Clear the node related cache files (anything that would get picked up on a node start/restart)
function clearNodeCache() {
	packageJsonHash=$(sha256sum $packageJson)
	nodemonJsonHash=$(sha256sum $nodemonJson)
	$cacheUtil "$PROJECT_ID" update $packageJsonKey "$packageJsonHash" $nodemonJsonKey "$nodemonJsonHash"
}

# Create the application image and container and start it
if [ "$COMMAND" == "create" ]; then
	# clean the container
	cleanContainer

	# Initialize the cache
	initCache

	# Set initial state to stopped
	$util updateAppState $PROJECT_ID $APP_STATE_STOPPED
	create

# Update the application as needed
elif [ "$COMMAND" == "update" ]; then
	dockerfileHash=$(sha256sum $dockerfile)
	dockerfileToolsHash=$(sha256sum $dockerfileTools)
	packageJsonHash=$(sha256sum $packageJson)
	nodemonJsonHash=$(sha256sum $nodemonJson)
	changedList=`$cacheUtil "$PROJECT_ID" getChanged $dockerfileKey "$dockerfileHash" $dockerfileToolsKey "$dockerfileToolsHash" $packageJsonKey "$packageJsonHash" $nodemonJsonKey "$nodemonJsonHash"`
	if [ "$IN_K8" == "true" ]; then
		chartDirHash=$(find $chartDir -type f -name "*.yaml" -exec sha256sum {} + | awk '{print $1}' | sort | sha256sum)
		changedListK8=`$cacheUtil "$PROJECT_ID" getChanged $chartDirKey "$chartDirHash"`
		changedList+=("${changedListK8[@]}")
	fi
	action=NONE
	if [ $FORCE_ACTION ] && [ "$FORCE_ACTION" != "NONE" ]; then
		action=$FORCE_ACTION
	else
		for item in ${changedList[@]}; do
			echo "$item changed"
			if [ "$item" == "$dockerfileKey" ] || [ "$item" == "$dockerfileToolsKey" ] || [ "$item" == "$chartDirKey" ]; then
				action=REBUILD
				break
			elif [ "$item" == "$packageJsonKey" ] || [ "$item" == "$nodemonJsonKey" ]; then
				action=RESTART
				# need to keep looking in case a Dockerfile was changed
			fi
		done
	fi
	echo "Action for project $projectName: $action"
	if [ "$action" == "REBUILD" ]; then
		echo "Rebuilding project: $projectName"
		cleanContainer
		create
	elif [ "$action" == "RESTART" ]; then
		if [ "$IN_K8" == "true" ]; then
			# On Kubernetes, changed files are only copied over through docker build
			echo "Rebuilding project: $projectName"
			create
		else
			echo "Restarting node/nodemon for changed config file"
			$IMAGE_COMMAND exec $project /scripts/noderun.sh stop
			$util updateAppState $PROJECT_ID $APP_STATE_STOPPING

			$IMAGE_COMMAND exec $project /scripts/noderun.sh start $AUTO_BUILD_ENABLED $START_MODE $HOST_OS
			$util updateAppState $PROJECT_ID $APP_STATE_STARTING
		fi
	else
		if [ "$IN_K8" == "true" ]; then
			# No nodemon on Kubernetes and changed files are only copied over through docker build
			echo "Rebuilding project: $projectName"
			create
		elif [ "$AUTO_BUILD_ENABLED" != "true" ]; then
			# If auto build disabled then not using nodemon and need to restart
			echo "Restarting node for changed file"
			$IMAGE_COMMAND exec $project /scripts/noderun.sh stop
			$util updateAppState $PROJECT_ID $APP_STATE_STOPPING
			$IMAGE_COMMAND exec $project /scripts/noderun.sh start $AUTO_BUILD_ENABLED $START_MODE $HOST_OS
			$util updateAppState $PROJECT_ID $APP_STATE_STARTING
		fi
	fi

# Stop the application (not supported on Kubernetes)
elif [ "$COMMAND" == "stop" ]; then
	echo "Stopping node.js project $projectName"
	$IMAGE_COMMAND exec $project /scripts/noderun.sh stop
	$util updateAppState $PROJECT_ID $APP_STATE_STOPPING
# Start the application (not supported on Kubernetes)
elif [ "$COMMAND" == "start" ]; then
	echo "Starting node.js project $projectName"
	# Clear the cache since restarting node will pick up any changes to package.json or nodemon.json
	clearNodeCache
	$IMAGE_COMMAND exec $project /scripts/noderun.sh start $AUTO_BUILD_ENABLED $START_MODE $HOST_OS
	$util updateAppState $PROJECT_ID $APP_STATE_STARTING
# Enable auto build
elif [ "$COMMAND" == "enableautobuild" ]; then
	echo "Enabling auto build for node.js project $projectName"
	# Wipe out any changes to package.json or nodemon.json since restarting node will take care of them
	clearNodeCache
	$IMAGE_COMMAND exec $project /scripts/noderun.sh stop
	$util updateAppState $PROJECT_ID $APP_STATE_STOPPING
	$IMAGE_COMMAND exec $project /scripts/noderun.sh start true $START_MODE $HOST_OS
	$util updateAppState $PROJECT_ID $APP_STATE_STARTING
	echo "Auto build for node.js project $projectName enabled"
# Disable auto build
elif [ "$COMMAND" == "disableautobuild" ]; then
	echo "Disabling auto build for node.js project $projectName"
	$IMAGE_COMMAND exec $project /scripts/noderun.sh stop
	$util updateAppState $PROJECT_ID $APP_STATE_STOPPING
	$IMAGE_COMMAND exec $project /scripts/noderun.sh start false $START_MODE $HOST_OS
	$util updateAppState $PROJECT_ID $APP_STATE_STARTING
	echo "Auto build for node.js project $projectName disabled"
# Remove the application
elif [ "$COMMAND" == "remove" ]; then
	echo "Removing the container for app $ROOT."

	if [ "$IN_K8" == "true" ]; then
		helm delete $project
	else
		# Remove container
		if [ "$($IMAGE_COMMAND ps -aq -f name=$project)" ]; then
			$IMAGE_COMMAND rm -f $project
		fi

		# Remove the node modules volume, as it needs to be deleted separately.
		if [ "$($IMAGE_COMMAND volume ls -q -f name=$project-nodemodules)" ]; then
			$IMAGE_COMMAND volume rm $project-nodemodules
		fi
	fi

	# Remove image
	if [ "$($IMAGE_COMMAND images -qa -f reference=$project)" ]; then
		$IMAGE_COMMAND rmi -f $project
	else
		echo The application image $project has already been removed.
	fi
# Rebuild the application
elif [ "$COMMAND" == "rebuild" ]; then
	echo "Rebuilding project: $projectName"
	cleanContainer
	create
else
	echo "ERROR: $COMMAND is not a recognized command" >&2

fi
