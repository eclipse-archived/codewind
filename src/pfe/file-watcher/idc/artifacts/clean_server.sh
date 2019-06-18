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
LOGNAME=$1
LIBERTY_ENV=$2
MAVEN_SETTINGS=$3

MAVEN_BUILD=maven.build

source $HOME/artifacts/envvars.sh

export JAVA_HOME=$HOME/java

cd $HOME/artifacts
./stop_server.sh

cd $HOME/app

if [ "$HOST_OS" == "windows" ]; then
	OUTPUT_DIR=/tmp/liberty
else
	OUTPUT_DIR=`pwd`/mc-target
fi

mvn clean -DlibertyEnv=microclimate -DmicroclimateOutputDir=$OUTPUT_DIR $MAVEN_SETTINGS --log-file $HOME/logs/$MAVEN_BUILD.log
