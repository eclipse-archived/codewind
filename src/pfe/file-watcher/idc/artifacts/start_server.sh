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

LIBERTY_REPO_CACHE=libertyrepocache
APP_DIR=$HOME/app

if [[ "$IN_K8" == "true" ]]; then
        LIBERTY_REPO_CACHE_PATH=$APP_DIR/libertyrepocache.zip
else
        LIBERTY_REPO_CACHE_PATH=/tmp/libertyrepocache.zip
fi

# If liberty feature cache doesn't exist then extract it
if [ ! -d $HOME/artifacts/$LIBERTY_REPO_CACHE ]; then
	cd $HOME/artifacts

	echo "Extracting liberty feature cache to $HOME/artifacts"
	$JAVA_HOME/bin/jar -xf $LIBERTY_REPO_CACHE_PATH
        cd -
	rm -rf $LIBERTY_REPO_CACHE_PATH
	mkdir -p /opt/ibm/wlp/etc
        cp $HOME/artifacts/repositories.properties /opt/ibm/wlp/etc/repositories.properties
	echo "Finished extracting liberty feature cache to $HOME/artifacts"
fi

# Verify liberty feature cache
if [ -d $HOME/artifacts/$LIBERTY_REPO_CACHE ]; then
	echo "Liberty feature cache is set up"

        # Remove liberty feature cache archive file if it still exists
        if [ -f $LIBERTY_REPO_CACHE_PATH ]; then
                rm -rf $LIBERTY_REPO_CACHE_PATH
        fi
else
	echo "Liberty feature cache is not set up"
fi

echo
if [ -f $SERVER_XML ]; then
        echo "Checking server status for $WLP_USER_DIR/servers/defaultServer $(date)"
        /opt/ibm/wlp/bin/server status
        RC=$?
        if [ $RC == 0 ]; then
                echo "The server is already running"
        else
                echo "Checking for missing runtime features for $WLP_USER_DIR/servers/defaultServer $(date)"
                /opt/ibm/wlp/bin/installUtility install --acceptLicense $WLP_USER_DIR/servers/defaultServer/server.xml
                echo "Starting server $WLP_USER_DIR/servers/defaultServer $(date)"
                /opt/ibm/wlp/bin/server start
                echo "Completed $(date)"
        fi
else 
	echo Before starting the server, you must first build the project.
        exit 1
fi
echo
