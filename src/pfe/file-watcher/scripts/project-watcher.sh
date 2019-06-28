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
HOSTNAME=$4
WATCHED_LIST=$5
IGNORED_LIST=$6
OPERATION_ID=$7
PORTAL_PORT=$8

LIBERTY_WATCHED_FILES=("$ROOT/src" "$ROOT/pom.xml" "$ROOT/Dockerfile-build" "$ROOT/Dockerfile");
NODE_WATCHED_FILES=("$ROOT/server" "$ROOT/test" "$ROOT/public" "$ROOT/Dockerfile" "$ROOT/Dockerfile-tools" "$ROOT/package.json" "$ROOT/nodemon.json");
SWIFT_WATCHED_FILES=("$ROOT/Sources" "$ROOT/Tests" "$ROOT/Package.swift" "$ROOT/Dockerfile" "$ROOT/Dockerfile-tools");
SPRING_WATCHED_FILES=("$ROOT/src" "$ROOT/pom.xml" "$ROOT/Dockerfile" "$ROOT/Dockerfile-build");
PORTAL_PROTOCOL="http";

## set file-watching by default to true, developers can change it to false to disable inotify based file watching
FILE_WATCHING="false"
if [ "$FILE_WATCHING" == "false" ]; then
	echo -e "File watching set to false. By default inotify is disabled. Will not watch any files."
	exit 0;
fi


if [ "$IN_K8" == "true" ]; then
	LIBERTY_WATCHED_FILES+=("$ROOT/chart");
	NODE_WATCHED_FILES+=("$ROOT/chart");
	SWIFT_WATCHED_FILES+=("$ROOT/chart");
	SPRING_WATCHED_FILES+=("$ROOT/chart");
fi

if [ "$PORTAL_PORT" == "9191" ]; then
	PORTAL_PROTOCOL="https";
fi

echo "PORTAL_PORT: $PORTAL_PORT";
echo "PORTAL_PROTOCOL: $PORTAL_PROTOCOL";

function watchProject() {
	local LASTTS=0;
	local LASTSETTINGTS=0;
	# Watch for changes and rebuild / restart.
	# Merge multiple events with the same timestamp so we don't trigger multiple builds
	# for editors that perform multiple file operations on a save.
	inotifywait --format "%T:%w%f" --timefmt %s -e CREATE -e CLOSE_WRITE -e MODIFY -e DELETE -r --exclude $IGNORED_FILES -m "${WATCHED_FILES[@]}" 2>"/tmp/$PROJECT_ID.log" | while read EVENT
	do
		echo "EVENT is $EVENT";
		local IFS=:
		local SPLIT=($EVENT);
		local TS=${SPLIT[0]};
		local FILE=${SPLIT[1]};

		if [[ "$FILE" == "'$ROOT/.cw-settings'" ]]; then
			if ! [[ $TS -eq $LASTSETTINGTS ]]; then
				if [[ ! -z $HOSTNAME ]]; then
					curl -sS -k -X POST $PORTAL_PROTOCOL://$HOSTNAME:$PORTAL_PORT/internal/api/v1/projects/$PROJECT_ID/settingsFileChanged
				else
					curl -sS -k -X POST $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/$PROJECT_ID/settingsFileChanged
				fi
				LASTSETTINGTS=$TS;
			fi
		elif ! [[ $TS -eq $LASTTS ]]; then
			echo "File changed: $FILE";
			echo '{"location": "'$ROOT'"}';
			# Trigger the file-watcher update
			if [[ ! -z $HOSTNAME ]]; then
				curl -sS -k -X POST $PORTAL_PROTOCOL://$HOSTNAME:$PORTAL_PORT/internal/api/v1/projects/$PROJECT_ID/updateProject
			else
				curl -sS -k -X POST $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/$PROJECT_ID/updateProject
			fi
			LASTTS=$TS;
		else
			echo "Notification timestamps $TS and $LASTTS match for file $FILE, skipping build.";
		fi

	done;

}

function monitorInotifyStderr() {
	while true
	do
		logFile="/tmp/$PROJECT_ID.log";
		if [ -f $logFile ]; then
			content=`cat $logFile`;
			if [[ "$content" == *"Watches established"* ]]; then
				echo "Watches established."
				rm -rf "/tmp/$PROJECT_ID.log";

				if [[ ! -z "$OPERATION_ID" ]] && [[ "$OPERATION_ID" != "undefined" ]]; then
					if [[ ! -z $HOSTNAME ]]; then
						curl -sS -k -X POST -H "Content-Type: application/json" -d '{"operationId": "'$OPERATION_ID'", "status": "success"}' $PORTAL_PROTOCOL://$HOSTNAME:$PORTAL_PORT/internal/api/v1/projects/$PROJECT_ID/inotifyStatus
					else
						curl -sS -k -X POST -H "Content-Type: application/json" -d '{"operationId": "'$OPERATION_ID'", "status": "success"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/$PROJECT_ID/inotifyStatus
					fi
				fi
				exit
			elif [[ "$content" == *"Error"* ]] || [[ "$content" == *"Couldn't watch"* ]]; then
				echo "Watch failed to be established."
				echo "$content";
				rm -rf "/tmp/$PROJECT_ID.log";
				if [[ ! -z "$OPERATION_ID" ]] && [[ "$OPERATION_ID" != "undefined" ]]; then
					if [[ ! -z $HOSTNAME ]]; then
						curl -sS -k -X POST -H "Content-Type: application/json" -d '{"operationId": "'$OPERATION_ID'", "status": "failed"}' $PORTAL_PROTOCOL://$HOSTNAME:$PORTAL_PORT/internal/api/v1/projects/$PROJECT_ID/inotifyStatus
					else
						curl -sS -k -X POST -H "Content-Type: application/json" -d '{"operationId": "'$OPERATION_ID'", "status": "failed"}' $PORTAL_PROTOCOL://localhost:$PORTAL_PORT/internal/api/v1/projects/$PROJECT_ID/inotifyStatus
					fi
				fi
				exit
			fi
		fi
		sleep 1
	done;
}

# (/node_modules|/.git|/.DS_Store|/.project) are regexs looking for any path containing those strings
# IGNORED_LIST are expected to be full path of a file or directory which would be provided through the API
# .swp, swx, 4913 files are all temporary files created by vim & vi, need to ignore thoses files
IGNORED_FILES="(/node_modules|/.git|/.DS_Store|/.project|.swp|.swx|/4913$|/.cw-settings~)";
if [[ $IGNORED_LIST ]] && [[ "$IGNORED_LIST" != "undefined" ]]; then
	echo "IGNORED_LIST: $IGNORED_LIST";
	IFS=', ' read -r -a IGNORED_ARRAY <<< "$IGNORED_LIST"
	for value in "${IGNORED_ARRAY[@]}"
	do
		IGNORED_FILES="$IGNORED_FILES|$value"
	done
	echo "IGNORED_FILES -> $IGNORED_FILES";
fi

WATCHED_FILES=();
# If WATCHED_LIST has been set
if [[ $WATCHED_LIST ]] && [[ "$WATCHED_LIST" != "undefined" ]]; then
	echo "WATCHED_LIST: $WATCHED_LIST";
	# convert string argument to array
	IFS=',' read -r -a WATCHED_ARRAY <<< "$WATCHED_LIST"

	# only watch existing files and directories
	for value in "${WATCHED_ARRAY[@]}"
	do
		if [ -e "$value" ]; then
			WATCHED_FILES+=("$value")
		else
			echo "Watch will not be established for "$value", since it does not exist."
		fi
	done
fi

#Append to WATCHED_FILES if there is any predefined watched files
if [ -f "$ROOT/pom.xml" ]; then
	echo "'$ROOT/pom.xml' exists";
	echo "Starting Java project";
	spring=false;
	tag=microclimate-dev-liberty
	if grep -q org.springframework.boot "$ROOT/pom.xml"; then
		spring=true;
		tag=microclimate-dev-spring
	fi
	project=$tag-'$ROOT'

	echo "Watching '$ROOT/src'"
	if $spring; then
		# Save existing files into WATCHED_FILES
		for value in "${SPRING_WATCHED_FILES[@]}"
		do
			if [ -e "$value" ]; then
				WATCHED_FILES+=("$value");
			fi
		done
		echo "WATCHED_FILES -> ${WATCHED_FILES[@]}";
	else
		# Save existing files into WATCHED_FILES
		for value in "${LIBERTY_WATCHED_FILES[@]}"
		do
			if [ -e "$value" ]; then
				WATCHED_FILES+=("$value");
			fi
		done

		# check for if dockerfile-dev exists, then we add it to the watch list
		# this needs to be independet of dockerfile-lang
		if [ -f "$ROOT/Dockerfile-dev" ]; then
			echo "Dockerfile-dev exists, add Dockerfile-dev into WATCHED_FILES"
			WATCHED_FILES+=("$ROOT/Dockerfile-dev");
		fi

		# if dockerfile-lang is missing, check for dockerfile
		if [ ! -f "$ROOT/Dockerfile-lang" ]; then
			echo "Dockerfile-lang is missing, check for Dockerfile"
			if [ -f "$ROOT/Dockerfile" ]; then
				echo "Dockerfile exists, add Dockerfile into WATCHED_FILES"
				WATCHED_FILES+=("$ROOT/Dockerfile");
			fi
		else
			# dockerfile-lang exists so we add it to the watched list
			echo "Dockerfile-lang exists, adding it into WATCHED_FILES"
			WATCHED_FILES+=("$ROOT/Dockerfile-lang");
		fi
	fi
elif [ -f "$ROOT/package.json" ]; then
	echo "'$ROOT/package.json' exists";
	# echo "Node.js project updates are handled by nodemon";
	# Save existing files into WATCHED_FILES
	for value in "${NODE_WATCHED_FILES[@]}"
	do
		if [ -e "$value" ]; then
			WATCHED_FILES+=("$value");
		fi
	done
elif [ -f "$ROOT/Package.swift" ]; then
	echo "'$ROOT/Package.swift' exists";
	echo "Starting Swift project";
	# Save existing files into WATCHED_FILES
	for value in "${SWIFT_WATCHED_FILES[@]}"
	do
		if [ -e "$value" ]; then
			WATCHED_FILES+=("$value");
		fi
	done
fi
# Initial steps to bring up project are invoked through the REST API
# Start watching for changes


if [ ${#WATCHED_FILES[@]} -eq 0 ]; then
	# Watch the entire project dir if there is no WATCHED_FILES
    WATCHED_FILES+=("'$ROOT'");
fi

if [ -e "'$ROOT/.cw-settings'" ]; then
	WATCHED_FILES+=("'$ROOT/.cw-settings'");
fi

echo "WATCHED_FILES -> ${WATCHED_FILES[@]}";
monitorInotifyStderr &
watchProject $IGNORED_FILES $WATCHED_FILES;
