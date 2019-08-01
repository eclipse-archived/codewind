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

## ------------- input init kubernetes pod logic -------------

if [[ "$IN_K8" == "true" ]]; then
    # Output error messages if either of the directories / symlinks exist
    if [[ -L $HOME/logs || -d $HOME/logs || -f $HOME/logs ]]; then
        echo "Warning: There is already a directory, symlink, or file at $HOME/logs"
        echo "Symlinking to $HOME/logs will fail and project logs will not show up"
    fi

    if [[ -L $HOME/app || -d $HOME/app || -f $HOME/app ]]; then
        echo "Error: There is already a directory, symlink, or file at $HOME/app"
        echo "Symlinking to $HOME/app will fail and cause the project to fail to build"
        exit 1;
    fi

    # Output a warning if the .log directory in /codewind-workspace directory doesn't already exist
    if [[ ! -d /codewind-workspace/.logs/$LOG_FOLDER ]]; then
        echo "Warning: /codewind-workspace/.logs/$LOG_FOLDER does not already exist, something may be wrong with the portal or file-watcher container."
        echo "Creating a folder at /codewind-workspace/.logs/$LOG_FOLDER"
        mkdir -p /codewind-workspace/.logs/$LOG_FOLDER
    fi

    # Output a warning if the $PROJECT_NAME directory in /codewind-workspace directory doesn't already exist
    if [[ ! -d /codewind-workspace/$PROJECT_NAME ]]; then
        echo "Error: /codewind-workspace/$PROJECT_NAME does not already exist, something may be wrong with either the portal or file-watcher container."
        echo "Exiting, as there will be no project to build"
        exit 1;
    fi

    # Create symlinks to $HOME/logs and $HOME/app on the Liberty app container / pod
    # Note that $PROJECT_NAME is an env-var defined and set in the liberty app's deployment.yaml
    ln -s /codewind-workspace/.logs/$LOG_FOLDER $HOME/logs
    ln -s /codewind-workspace/$PROJECT_NAME $HOME/app
fi

## ------------- old new entry point logic -------------

source $HOME/artifacts/envvars.sh
$HOME/artifacts/server_setup.sh
LIBERTY_REPO_CACHE=libertyrepocache
APP_DIR=$HOME/app

# If liberty feature cache doesn't exist then extract it
if [ ! -d $HOME/artifacts/$LIBERTY_REPO_CACHE ]; then
	cd $HOME/artifacts

	echo "Extracting liberty feature cache to $HOME/artifacts"
	$JAVA_HOME/bin/jar -xf $APP_DIR/libertyrepocache.zip
	rm -rf $APP_DIR/libertyrepocache.zip
	mkdir -p /opt/ibm/wlp/etc
    cp $HOME/artifacts/repositories.properties /opt/ibm/wlp/etc/repositories.properties
	echo "Finished extracting liberty feature cache to $HOME/artifacts"
fi

# Verify liberty feature cache
if [ -d $HOME/artifacts/$LIBERTY_REPO_CACHE ]; then
	echo "Liberty feature cache is set up"

    # Remove liberty feature cache archive file if it still exists
    if [ -f $APP_DIR/libertyrepocache.zip ]; then
        rm -rf $APP_DIR/libertyrepocache.zip
    fi
else
	echo "Liberty feature cache is not set up"
fi

# Use the server log messages for container logs
mkdir -p $WLP_USER_DIR/servers/defaultServer/logs
touch $WLP_USER_DIR/servers/defaultServer/logs/messages.log
tail -f $WLP_USER_DIR/servers/defaultServer/logs/messages.log
