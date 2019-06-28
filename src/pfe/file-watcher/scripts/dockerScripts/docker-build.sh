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

set -o pipefail

util=/file-watcher/scripts/util.sh

ARGS=$1
PROJECT_FOLDER=$2
LOG_FILE=$3
PROJECT_ID=$4

echo -e "Touching container build log file: "$LOG_FILE""
touch "$LOG_FILE"
echo -e "Triggering log file event for: container build log"
$util newLogFileAvailable $PROJECT_ID "build"

echo "Running docker container build command: $IMAGE_COMMAND $ARGS "$PROJECT_FOLDER" |& tee "$LOG_FILE""
$IMAGE_COMMAND $ARGS "$PROJECT_FOLDER" |& tee "$LOG_FILE"
