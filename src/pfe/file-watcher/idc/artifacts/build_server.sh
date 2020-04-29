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

LOGNAME=$1
LIBERTY_ENV=$2
MAVEN_SETTINGS=$4

MAVEN_BUILD=maven.build
MAVEN_M2_CACHE=.m2/repository
APP_DIR=$HOME/app

if [[ "$IN_K8" == "true" ]]; then
        MAVEN_REPO_CACHE_PATH=$APP_DIR/localm2cache.zip
else
        MAVEN_REPO_CACHE_PATH=/tmp/localm2cache.zip
fi

# Maven requires a JDK, the standard liberty image only includes a JRE
export JAVA_HOME=$HOME/java

# If maven m2 cache doesn't exist then extract it
if [ ! -d $HOME/$MAVEN_M2_CACHE ]; then
	cd $HOME

	echo "Extracting maven m2 cache to $HOME"
	$JAVA_HOME/bin/jar -xf $MAVEN_REPO_CACHE_PATH
	rm -rf $MAVEN_REPO_CACHE_PATH
	echo "Finished extracting maven m2 cache to $HOME"
fi

# Verify maven m2 cache
if [ -d $HOME/$MAVEN_M2_CACHE ]; then
	echo "Maven m2 cache is set up for $LOGNAME"

	# Remove maven m2 cache archive file if it still exists
	if [ -f $MAVEN_REPO_CACHE_PATH ]; then
		rm -rf $MAVEN_REPO_CACHE_PATH
	fi
else
	echo "Maven m2 cache is not set up for $LOGNAME"
fi

cd $APP_DIR

if [ "$HOST_OS" == "windows" ]; then
	export MICROCLIMATE_OUTPUT_DIR=/tmp/liberty
else
	export MICROCLIMATE_OUTPUT_DIR=`pwd`/mc-target
fi
echo "Maven build output directory is set to $MICROCLIMATE_OUTPUT_DIR"

# copy settings.xml if present
if [[ -f settings.xml ]]; then
    mkdir -p $HOME/.m2/
    mv settings.xml $HOME/.m2/
fi

if [[ $1 && $1 == "prod" ]]; then
	echo "Start mvn package for production"
	echo "mvn -B package -DinstallDirectory=/opt/ibm/wlp"
	mvn -B package -DinstallDirectory=/opt/ibm/wlp
	# remove settings.xml after build
	rm -f $HOME/.m2/settings.xml
	exit 0
fi

mkdir -p $HOME/logs
chown -R 1001 $HOME/logs

if [ -f $SERVER_XML ]; then
	if [[ $3 && $3 == "config" ]]; then
		echo "Start mvn build with config change for $LOGNAME $(date)"
        echo "mvn -B package liberty:install-apps -DskipTests=true -DlibertyEnv=microclimate -DmicroclimateOutputDir=$MICROCLIMATE_OUTPUT_DIR $MAVEN_SETTINGS --log-file $HOME/logs/$MAVEN_BUILD.log"
        mvn -B package liberty:install-apps -DskipTests=true -DlibertyEnv=microclimate -DmicroclimateOutputDir=$MICROCLIMATE_OUTPUT_DIR $MAVEN_SETTINGS --log-file $HOME/logs/$MAVEN_BUILD.log
		echo "Finished mvn build with config change for $LOGNAME $(date)"
	else
		echo "Start mvn compile for $LOGNAME $(date)"
        echo "mvn -B compile -DskipTests=true -DlibertyEnv=microclimate -DmicroclimateOutputDir=$MICROCLIMATE_OUTPUT_DIR $MAVEN_SETTINGS --log-file $HOME/logs/$MAVEN_BUILD.log"
        mvn -B compile -DskipTests=true -DlibertyEnv=microclimate -DmicroclimateOutputDir=$MICROCLIMATE_OUTPUT_DIR $MAVEN_SETTINGS --log-file $HOME/logs/$MAVEN_BUILD.log
		echo "Finished mvn compile for $LOGNAME $(date)"
	fi
else
	echo "Start mvn package for $LOGNAME $(date)"
    echo "mvn -B package -DskipTests=true -DlibertyEnv=microclimate -DmicroclimateOutputDir=$MICROCLIMATE_OUTPUT_DIR $MAVEN_SETTINGS --log-file $HOME/logs/$MAVEN_BUILD.log"
    mvn -B package -DskipTests=true -DlibertyEnv=microclimate -DmicroclimateOutputDir=$MICROCLIMATE_OUTPUT_DIR $MAVEN_SETTINGS --log-file $HOME/logs/$MAVEN_BUILD.log
	echo "Finished mvn package for $LOGNAME $(date)"
fi

# remove settings.xml after build
rm -f $HOME/.m2/settings.xml
