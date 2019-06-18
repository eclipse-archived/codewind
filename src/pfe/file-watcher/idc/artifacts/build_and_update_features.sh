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
MAVEN_SETTINGS=$3

cd $HOME/artifacts

# The server must be stopped in order to run installUtility
./stop_server.sh
echo

./build_server.sh $LOGNAME $LIBERTY_ENV config "$MAVEN_SETTINGS"
echo

# Start the server back up (and run installUtility)
./start_server.sh
echo
