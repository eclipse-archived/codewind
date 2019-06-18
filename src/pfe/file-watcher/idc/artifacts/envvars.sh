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

if [ "$HOST_OS" == "windows" ]; then
        export WLP_USER_DIR=/tmp/liberty/liberty/wlp/usr
else
        export WLP_USER_DIR=$HOME/app/mc-target/liberty/wlp/usr
fi
export SERVER_XML=$WLP_USER_DIR/servers/defaultServer/server.xml

export LOG_DIR=
export WLP_OUTPUT_DIR=
