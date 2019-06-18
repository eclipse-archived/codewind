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

if [ "$#" -lt 3 ]; then
	echo "* First argument should be the idc argument, the second should be the app path, the third should be the log location"
 	exit 1
fi

IDCARG=$1
APP_PATH=$2
LOGFILE=$3
CLITEST=$4

cd $APP_PATH
echo -------------------------------------------- >> $LOGFILE
date >> $LOGFILE
echo START RUN >> $LOGFILE

echo PWD is $PWD >> $LOGFILE
echo IDCARG is $IDCARG >> $LOGFILE
echo APP_PATH is $APP_PATH >> $LOGFILE
echo ENV PATH is $PATH >> $LOGFILE

if [[ -z "$CLITEST" ]];
then
    source $APP_PATH/../idc $IDCARG >> $LOGFILE
else
    source $APP_PATH/../idc $IDCARG
fi



echo END RUN >> $LOGFILE
echo -------------------------------------------- >> $LOGFILE