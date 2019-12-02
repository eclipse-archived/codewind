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

# General utilities, the utility to run is determined by the first parameter

COMMAND=$1
shift 1

PORTAL_PROTOCOL="http"
PORTAL_PORT="9090"
if [ "$PORTAL_HTTPS" == "true" ]; then
	PORTAL_PROTOCOL="https"
	PORTAL_PORT="9191"
fi

function updateAppState() {
	echo "Sending update state post for project $projectID and state $state"
	if [ -z "$error" ]; then
		curl -sS -k -X POST -H "Content-Type: application/json" -d '{"projectID": "'$projectID'", "status": "'$state'", "type": "appState"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/updateStatus
	else
		curl -sS -k -X POST -H "Content-Type: application/json" -d '{"projectID": "'$projectID'", "status": "'$state'", "error": "'"$error"'", "type": "appState"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/updateStatus
	fi
	if [ $? -ne 0 ]; then
		echo "State update for project $projectID failed with exit code: $?" >&2
	fi
}

function updateBuildState() {
	echo "Sending update build state post for project $projectID and state $state"
	if [ -z "$message" ]; then
		curl -sS -k -X POST -H "Content-Type: application/json" -d '{"projectID": "'$projectID'", "buildStatus": "'$state'", "type": "buildState"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/updateStatus
	elif [ -z "$appImagelastbuild" ]; then
		echo curl -sS -k -X POST -H "Content-Type: application/json" -d '{"projectID": "'$projectID'", "buildStatus": "'$state'", "detailedBuildStatus": "'"$message"'", "type": "buildState"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/updateStatus
		curl -sS -k -X POST -H "Content-Type: application/json" -d '{"projectID": "'$projectID'", "buildStatus": "'$state'", "detailedBuildStatus": "'"$message"'", "type": "buildState"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/updateStatus
	elif [ -z "$buildImagelastbuild" ]; then
		echo curl -sS -k -X POST -H "Content-Type: application/json" -d '{"projectID": "'$projectID'", "buildStatus": "'$state'", "detailedBuildStatus": "'"$message"'", "appImageLastBuild": "'"$appImagelastbuild"'", "type": "buildState"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/updateStatus
		curl -sS -k -X POST -H "Content-Type: application/json" -d '{"projectID": "'$projectID'", "buildStatus": "'$state'", "detailedBuildStatus": "'"$message"'", "appImageLastBuild": "'"$appImagelastbuild"'", "type": "buildState"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/updateStatus
	else
		echo curl -sS -k -X POST -H "Content-Type: application/json" -d '{"projectID": "'$projectID'", "buildStatus": "'$state'", "detailedBuildStatus": "'"$message"'", "buildImageLastBuild": "'"$buildImageLastBuild"'", "type": "buildState"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/updateStatus
		curl -sS -k -X POST -H "Content-Type: application/json" -d '{"projectID": "'$projectID'", "buildStatus": "'$state'", "detailedBuildStatus": "'"$message"'", "buildImageLastBuild": "'"$buildImageLastBuild"'", "type": "buildState"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/updateStatus
	fi
	if [ $? -ne 0 ]; then
		echo "State build state update for project $projectID failed with exit code: $?" >&2
	fi
}

function newLogFileAvailable() {
	curl -sS -k -X GET $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/$projectID/logs/$type
}

function imagePushRegistryStatus() {
	curl -sS -k -X POST -H "Content-Type: application/json" -d '{"projectID": "'$projectID'", "detailedImagePushRegistryStatus": "'"$message"'"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/imagePushRegistryStatus
}

function getWorkspacePathForVolumeMounting() {
	workspace=$LOCAL_WORKSPACE
	# Convert C:\Users... to /C/Users..
	if [ "$HOST_OS" == "windows" ]; then
		if [[ $LOCAL_WORKSPACE == *":"* ]]; then
			# replace first colon
			temp=/${LOCAL_WORKSPACE/:/}
			# replace backward slash to forward slash
			workspace=${temp//\\/\/}
		fi
	fi
	echo "$workspace"
}

if [ "$COMMAND" == "updateAppState" ]; then
	projectID=$1
	state=$2
	error=$3
	updateAppState $projectID $state "$error" &
elif [ "$COMMAND" == "updateBuildState" ]; then
	projectID="$1"
	state="$2"
	message="$3"
	appImagelastbuild="$4"
	buildImagelastbuild="$5"
	echo updateBuildState "$projectID" "$state" "$message" "$appImagelastbuild" "$buildImagelastbuild" &
	updateBuildState "$projectID" "$state" "$message" "$appImagelastbuild" "$buildImagelastbuild" &
elif [ "$COMMAND" == "newLogFileAvailable" ]; then
 	projectID=$1
 	type=$2
 	newLogFileAvailable $projectID $type &
elif [ "$COMMAND" == "imagePushRegistryStatus" ]; then
 	projectID=$1
	message="$2"
 	imagePushRegistryStatus "$projectID" "$status" "$message" &
elif [ "$COMMAND" == "getWorkspacePathForVolumeMounting" ]; then
 	LOCAL_WORKSPACE=$1
 	retval=$( getWorkspacePathForVolumeMounting "$LOCAL_WORKSPACE" )
	echo "$retval"
fi
