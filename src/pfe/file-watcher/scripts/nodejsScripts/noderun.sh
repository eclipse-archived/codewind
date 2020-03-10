#!/bin/sh
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

COMMAND=$1
AUTO_BUILD_ENABLED=$2
START_MODE=$3
OS=$4

LOG_DIR=/output
LOG_FILE=$LOG_DIR/container.log
SCRIPTS_DIR=/scripts
CACHE_FILE=$SCRIPTS_DIR/cache.txt

echo "Starting noderun with command $COMMAND and auto build enabled set to $AUTO_BUILD_ENABLED"

PID=

mkdir -p $LOG_DIR

cd /app

readCache() {
    if [ -f $CACHE_FILE ]; then
       PID=$(awk -F 'pid=' 'NF>0 { print $2 }' $CACHE_FILE |  tr -d '[:space:]')
    fi
    echo "Read in PID $PID from cache"
}

writeCache() {
    echo "Write PID $PID to cache"
    echo "" > $CACHE_FILE
    if [ -n $PID ]; then
        echo "pid=$PID" >> $CACHE_FILE
    fi
}

stop() {
    echo "Stop node and unset PID"
    if [ -n $PID ]; then
       kill -- -$(ps -o pgid= $PID | grep -o [0-9]*)
    fi
    PID=
}

start() {
    echo "Start node project in $START_MODE mode, auto build is $AUTO_BUILD_ENABLED"

    npm install 1>> $LOG_FILE 2>> $LOG_FILE

    PROJECT_LINKS_ENV_FILE="/app/.codewind-project-links.env"
	if [ -f "$PROJECT_LINKS_ENV_FILE" ]; then
		while read LINE; do export "$LINE"; done < $PROJECT_LINKS_ENV_FILE
	fi

    # One of two npm scripts will be run: 'start' or 'debug'.
    # If auto build is enabled, we wrap the script in 'nodemon'.

    prefix=""
    if [ "$AUTO_BUILD_ENABLED" = "true" ]; then
        npm install -g nodemon >> $LOG_FILE 2>> $LOG_FILE
        # Wrap the npm script in nodemon
        # If os passed in is windows, use the legacy watch option
        if [ "$OS" = "windows" ]; then
            prefix="nodemon -L --exec"
        else
            prefix="nodemon --exec"
        fi
    fi

    npm_script="start"
    # Treat debug and debugNoInit the same. If the user wants to debug init,
    # they can replace '--inspect' with '--inspect-brk' in package.json themselves
    if [ "$START_MODE" = "debug" ] || [ "$START_MODE" = "debugNoInit" ]; then
        npm_script="debug"
    fi

    set -x
    $prefix npm run "$npm_script" 1>> $LOG_FILE 2>> $LOG_FILE &
    set +x

    PID=$!
    echo "PID is $PID"
}

if [ "$COMMAND" = "start" ]; then
    start $AUTO_BUILD_ENABLED $START_MODE
    writeCache $PID
elif [ "$COMMAND" = "stop" ]; then
    readCache $PID
    stop $PID
    writeCache $PID
elif [ "$COMMAND" = "isActive" ]; then
    readCache $PID
    if [ -n $PID ]; then
        TIMEOUT=0
        until [ $TIMEOUT -eq 10 ]; do
            PS_DIR="/proc/$PID"
            if [ -d $PS_DIR ]; then
                # Check if using nodemon
                cat $PS_DIR/cmdline | grep nodemon
                if [ $? -eq 0 ]; then
                    # The nodemon process stays around even when there is an error so check for PID
                    # as the parent process id as well
                    PARENT_PROCESS_ID=$(awk -F 'PPid:' 'NF>0 { print $2 }' $PS_DIR/status |  tr -d '[:space:]')
                    echo "Parent process ID: $PARENT_PROCESS_ID"
                    if [ -d /proc/$PARENT_PROCESS_ID ]; then
                        exit 0
                    fi
                else
                    # Not using nodemon so don't need to check anything else
                    exit 0
                fi
            fi
            TIMEOUT=`expr "$TIMEOUT" + 1`
            sleep 1
        done
        echo "Could not find a running node/nodemon process. Try restarting the processes by toggling the auto build preference."
        exit 1
    else
        echo "No process id registered.  Assume node is not running."
        exit 1
    fi
fi
