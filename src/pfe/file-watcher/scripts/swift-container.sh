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
FOLDER_NAME=${11}
IMAGE_PUSH_REGISTRY=${12}


WORKSPACE=/codewind-workspace
LOG_FOLDER=$WORKSPACE/.logs/$FOLDER_NAME

COMPILE_BUILD=app.compile
DOCKER_BUILD_LOG=docker.build
DOCKER_APP_LOG=docker.app
APP_LOG=app

echo "*** SWIFT"
echo "*** PWD = $PWD"
echo "*** ROOT = $ROOT"
echo "*** LOCAL_WORKSPACE = $LOCAL_WORKSPACE"
echo "*** PROJECT_ID = $PROJECT_ID"
echo "*** COMMAND = $COMMAND"
echo "*** CONTAINER_NAME = $CONTAINER_NAME"
echo "*** FOLDER_NAME = $FOLDER_NAME"
echo "*** LOG_FOLDER = $LOG_FOLDER"
echo "*** IMAGE_PUSH_REGISTRY = $IMAGE_PUSH_REGISTRY"


tag=microclimate-dev-swift
projectName=$( basename "$ROOT" )
project=$CONTAINER_NAME
util=/file-watcher/scripts/util.sh

# Import general constants
source /file-watcher/scripts/constants.sh

tempFolder=/tmp/$project
echo project=$project
prevDir=`pwd`
cd "$ROOT"

set -o pipefail

function create() {
	# Fix to stop file-watcher from attempting the rebuild procedure
	STOP_WATCHING_CHECK="$ROOT/codewind-stop-watching-flag";
	echo $STOP_WATCHING_CHECK;
	if [ -f "$STOP_WATCHING_CHECK" ]; then
		echo "Stop watching flag found. Doing nothing.";
	else
		if [ "$IN_K8" == "true" ]; then
			deployK8s
		else
			deployLocal
		fi
	fi
}

function deployK8s() {
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

	# If there's an existing failed Helm release, delete it. See https://github.com/helm/helm/issues/3353
	if [ "$( helm list --failed -q | grep $project)" ]; then
		$util updateAppState $PROJECT_ID $APP_STATE_STOPPING
		helm delete $project
	fi

	# Create a temporary folder to build the dockerfile
	mkdir -p $tempFolder
	cp -r . $tempFolder
	cd $tempFolder

	# Merge Dockerfile and Dockerfile-tools, required to run swift container on K8s
	echo "RUN cd /swift-project && /swift-utils/tools-utils.sh build release > /swift-project/$COMPILE_BUILD.log" >> Dockerfile-tools
	sed -i 's/COPY.*/COPY --from=0 \/swift-project .\/swift-project/' Dockerfile
	cat Dockerfile >> Dockerfile-tools
	mv Dockerfile-tools Dockerfile

	# Build the project
	echo "$BUILD_IMAGE_INPROGRESS_MSG $projectName"
	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.buildApplicationImage"

	echo -e "Touching docker application build log file: "$LOG_FOLDER/$DOCKER_APP_LOG.log""
	touch "$LOG_FOLDER/$DOCKER_APP_LOG.log"
	echo -e "Triggering log file event for: docker application build log"
 	$util newLogFileAvailable $PROJECT_ID "build"

	echo -e "Docker app log file "$LOG_FOLDER/$DOCKER_APP_LOG.log""
	$IMAGE_COMMAND $BUILD_COMMAND -t $project . |& tee "$LOG_FOLDER/$DOCKER_APP_LOG.log"
	exitCode=$?
	imageLastBuild=$(($(date +%s)*1000))
	if [ $exitCode -eq 0 ]; then
		echo "Docker build successful for $projectName"
		$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.containerBuildSuccess" "$imageLastBuild"
	else
		echo "$BUILD_IMAGE_FAILED_MSG $projectName" >&2
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
		exit 3
	fi

	# Get rid of the temp folder
	cd "$ROOT"
	rm -rf $tempFolder

	# Copy the chart to a temp location and make sure it doesn't exist already.
	if [[ -d $tmpChart ]]; then
		rm -rf $tmpChart
	fi
	mkdir -p $tmpChart
	cp -fR $chartDir/* $tmpChart
	parentDir=$( dirname $tmpChart )

	echo "Modifying charts and running Helm install from $tmpChart"
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

		# Install the application using Helm
		helm upgrade $project $tmpChart \
			--install  \
			--recreate-pods
	else
		helm upgrade $project $tmpChart \
			--install  \
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
			errorMsg="Error starting project $projectName: pod for helm release $project failed to start."  # :NLS

			# Print the Helm status before deleting the release
			helm status $project

			helm delete $project

			$util updateAppState $PROJECT_ID $APP_STATE_STOPPED "$errorMsg"
			exit 3
		fi
		sleep 1;
	done

	# Delete any pods left that are terminating, to ensure they go away
	/file-watcher/scripts/kubeScripts/clear-terminating-pods.sh $project

	echo -e "Touching application compile log file: "$LOG_FOLDER/$COMPILE_BUILD.log""
	touch "$LOG_FOLDER/$COMPILE_BUILD.log"
	echo -e "Triggering log file event for: application compile log"
 	$util newLogFileAvailable $PROJECT_ID "build"

	# Grab the log file from the project's pod
	POD_NAME="$( kubectl get po --selector=release=$project | grep 'Running' | cut -d ' ' -f 1 )"
	kubectl cp $POD_NAME:/swift-project/$COMPILE_BUILD.log "$LOG_FOLDER/$COMPILE_BUILD.log"

	echo -e "Touching application log file: "$LOG_FOLDER/$APP_LOG.log""
	touch "$LOG_FOLDER/$APP_LOG.log"
	echo -e "Triggering log file event for: application log"
 	$util newLogFileAvailable $PROJECT_ID "app"

	# add the app logs
	echo -e "App log file $LOG_FOLDER/$APP_LOG.log"
	kubectl logs -f $(kubectl get po -o name --selector=release=$project) >> "$LOG_FOLDER/$APP_LOG.log" &
}

function dockerRun() {
	# Remove container if it already exists (could be from a failed attempt)
	if [ "$($IMAGE_COMMAND ps -aq -f name=$project)" ]; then
		$IMAGE_COMMAND rm -f $project
	fi

	workspace=`$util getWorkspacePathForVolumeMounting $LOCAL_WORKSPACE`
	echo "Workspace path used for volume mounting is: "$workspace""

	$IMAGE_COMMAND run --network=codewind_network --name "$project" -dt -P -w /swift-project "$project"
	if [ $? -eq 0 ]; then
		echo -e "Copying over source files"
		docker cp "$workspace/$projectName"/. "$project":/swift-project
	fi

}

function deployLocal() {
	if [ "$($IMAGE_COMMAND ps -q -f name=$project)" ]; then
		echo "Stopping existing container"
		$util updateAppState $PROJECT_ID $APP_STATE_STOPPING
		$IMAGE_COMMAND kill $($IMAGE_COMMAND ps -q -f name=$project)
	fi

	if [ "$($IMAGE_COMMAND ps -a -f name=$project)" ]; then
		echo "Remove an old container before trying to build a new one"
		$IMAGE_COMMAND rm -f $project
		$IMAGE_COMMAND rmi -f $project
	fi

	echo "$BUILD_IMAGE_INPROGRESS_MSG $projectName-build"
	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.buildBuildImage"

	echo -e "Touching docker container build log file: "$LOG_FOLDER/$DOCKER_BUILD_LOG.log""
	touch "$LOG_FOLDER/$DOCKER_BUILD_LOG.log"
	echo -e "Triggering log file event for: docker container build log"
 	$util newLogFileAvailable $PROJECT_ID "build"

	echo -e "Docker build log file "$LOG_FOLDER/$DOCKER_BUILD_LOG.log""
	$IMAGE_COMMAND $BUILD_COMMAND -t $project-build -f Dockerfile-tools . |& tee "$LOG_FOLDER/$DOCKER_BUILD_LOG.log"
	exitCode=$?
	imageLastBuild=$(($(date +%s)*1000))
	if [ $exitCode -eq 0 ]; then
		# Since local swift build is two stages, don't mark it as succeeded until both stages are finished
		echo "$BUILD_IMAGE_SUCCESS_MSG $projectName-build"
		$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.buildcontainerCreateSuccess" " " "$imageLastBuild"
	else
		echo "$BUILD_IMAGE_FAILED_MSG $projectName-build" >&2
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
		exit 3
	fi

	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.compileApplication"

	echo -e "Touching application compile log file: "$LOG_FOLDER/$COMPILE_BUILD.log""
	touch "$LOG_FOLDER/$COMPILE_BUILD.log"
	echo -e "Triggering log file event for: application compile log"
 	$util newLogFileAvailable $PROJECT_ID "build"

	# Map container to different port than the project is using
	echo "PWD BEFORE DOCKER RUN -------- ${PWD}"
	if [ "$($IMAGE_COMMAND ps -a -q -f name=$project-build)" ]; then
		echo "$project-build container exists. Starting container for $project-build..."
		$IMAGE_COMMAND start $project-build > "$LOG_FOLDER/$COMPILE_BUILD.log"
		if [ $? -eq 0 ]; then
			echo "Start container stage succeeded for $project-build"
		else
			echo "Start container stage failed for $project-build" >&2
			$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.compileFail"
			exit 3
		fi
	else
		echo "$project-build container does not exist. Starting container for $project-build..."
		workspace=`$util getWorkspacePathForVolumeMounting $LOCAL_WORKSPACE`
		echo "Workspace path used for volume mounting is: "$workspace""
		
		RUN_CMD=$($IMAGE_COMMAND run --name $project-build -w /swift-project $project-build /swift-utils/tools-utils.sh build release > "$LOG_FOLDER/$COMPILE_BUILD.log")
		RUN_CMD_EC=$?
		if [ $RUN_CMD_EC -eq 0 ]; then
			echo -e "Copying over source files back to PFE container from build container"
			docker cp $project-build:/swift-project/.build-ubuntu/. "$workspace/$projectName/.build-ubuntu"
		fi

		
		if [ $RUN_CMD_EC -eq 0 ]; then
			echo "Start container stage succeeded for $project-build"
		else
			echo "Start container stage failed for $project-build" >&2
			$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.compileFail"
			exit 3
		fi
	fi

	if [ $? -eq 0 ]
	then
		echo "Swift build complete - result: SUCCESS"
		echo "$BUILD_IMAGE_INPROGRESS_MSG $projectName"
		$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS "buildscripts.buildApplicationImage"

		echo -e "Touching docker application build log file: "$LOG_FOLDER/$DOCKER_APP_LOG.log""
		touch "$LOG_FOLDER/$DOCKER_APP_LOG.log"
		echo -e "Triggering log file event for: docker application build log"
 		$util newLogFileAvailable $PROJECT_ID "build"

		echo -e "Docker app log file "$LOG_FOLDER/$DOCKER_APP_LOG.log""
		$IMAGE_COMMAND $BUILD_COMMAND -t $project . |& tee "$LOG_FOLDER/$DOCKER_APP_LOG.log"
		exitCode=$?
		imageLastBuild=$(($(date +%s)*1000))
		if [ $exitCode -eq 0 ]; then
			echo "$BUILD_IMAGE_SUCCESS_MSG $projectName"
			$util updateBuildState $PROJECT_ID $BUILD_STATE_SUCCESS " " "$imageLastBuild"
			$util updateAppState $PROJECT_ID $APP_STATE_STARTING
		else
			echo "$BUILD_IMAGE_FAILED_MSG $projectName" >&2
			$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
			exit 3
		fi
		$IMAGE_COMMAND rm $project-build;
		echo "Starting container for $project..."
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
				errorMsg="Error starting project $projectName: container start failed for $project"  # :NLS
				$util updateAppState $PROJECT_ID $APP_STATE_STOPPED "$errorMsg"
				exit 3
			fi
		fi
		echo "Swift project launched"
	else
		echo "Swift build complete - result: FAILED" >&2
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED "buildscripts.buildFail"
		exit 3
	fi

	echo -e "Touching application log file: "$LOG_FOLDER/$APP_LOG.log""
	touch "$LOG_FOLDER/$APP_LOG.log"
	echo -e "Triggering log file event for: application log"
 	$util newLogFileAvailable $PROJECT_ID "app"

	# add the app logs
	echo -e "App log file "$LOG_FOLDER/$APP_LOG.log""
	$IMAGE_COMMAND logs -f "$CONTAINER_NAME" >> "$LOG_FOLDER/$APP_LOG.log" &
}
# Create the application image and container and start it
if [ "$COMMAND" == "create" ]; then
	# Set the initial state to stopped
	$util updateAppState $PROJECT_ID $APP_STATE_STOPPED
	create

# Update the application
elif [ "$COMMAND" == "update" ]; then
	create

# Remove the application
elif [ "$COMMAND" == "remove" ]; then
	echo "Removing the container and image for app $project."

	if [ "$IN_K8" == "true" ]; then
		echo "Killing app log process"
		pgrep -f "kubectl logs -f" | xargs kill -9

		# Remove the helm release
		helm delete $project
	else
		# Remove container
		if [ "$($IMAGE_COMMAND ps -aq -f name=$project)" ]; then
			$IMAGE_COMMAND rm -f $project
		fi
		
		if [ "$($IMAGE_COMMAND ps -q -f name=$project-build)" ]; then
			$IMAGE_COMMAND rm -f $project-build
		fi
	fi

	# Remove image
	if [ "$($IMAGE_COMMAND images -qa -f reference=$project)" ]; then
		$IMAGE_COMMAND rmi -f $project
	else
		echo The application image $project has already been removed.
	fi
	
	if [ "$($IMAGE_COMMAND images -qa -f reference=$project-build)" ]; then
		$IMAGE_COMMAND rmi -f $project-build
	else
		echo The application image $project-build has already been removed.
	fi

else
	echo "ERROR: $COMMAND is not a recognized command" >&2
fi
cd $prevDir
