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

source $HOME/artifacts/envvars.sh

$HOME/artifacts/server_setup.sh

APP_DIR=$HOME/app

echo
if [ -f "$SERVER_XML" ]; then
    echo "Checking server status for $WLP_USER_DIR/servers/defaultServer $(date)"
    /opt/ibm/wlp/bin/server status
    RC=$?
    if [ $RC == 0 ]; then
        echo "The server is already running"
    else
        echo "Checking for missing runtime features for $WLP_USER_DIR/servers/defaultServer $(date)"
        /opt/ibm/wlp/bin/installUtility install --acceptLicense $WLP_USER_DIR/servers/defaultServer/server.xml
        echo "Starting server $WLP_USER_DIR/servers/defaultServer in debug mode $(date)"

        PROJECT_LINKS_ENV_FILE="$APP_DIR/.codewind-project-links.env"
        if [ -f "$PROJECT_LINKS_ENV_FILE" ]; then
                while read LINE; do export "$LINE"; done < $PROJECT_LINKS_ENV_FILE
        fi

        /opt/ibm/wlp/bin/server debug 1>/dev/null 2>/dev/null &
        echo "Completed $(date)"
    fi
else
	echo Before starting the server, you must first build the project.
fi
echo
