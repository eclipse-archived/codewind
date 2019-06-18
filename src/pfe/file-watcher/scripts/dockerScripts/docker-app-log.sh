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

LOG_FILE=$1
CONTAINER_NAME=$2
IN_K8=$3
PROJECT_ID=$4

util=/file-watcher/scripts/util.sh

echo -e "Touching application log file: "$LOG_FILE""
touch "$LOG_FILE"
echo -e "Triggering log file event for: application log"
$util newLogFileAvailable $PROJECT_ID "app"

if [[ "$IN_K8" == "true" ]]; then
    pod=$( kubectl get po --selector=release=$CONTAINER_NAME | grep 'Running' | cut -d ' ' -f 1 )
    echo -e "Pod name for $CONTAINER_NAME is: $pod"
    if [[ ! -z $pod ]]; then
        # add the app logs
        echo -e "App log file "$LOG_FILE""
        kubectl logs -f $pod >> "$LOG_FILE" &
    fi
else
    # add the app logs
    echo -e "App log file "$LOG_FILE""
    docker logs -f $CONTAINER_NAME >> "$LOG_FILE" &
fi
