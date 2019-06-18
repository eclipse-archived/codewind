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

if [[ -f $WLP_USER_DIR/servers/defaultServer/server.xml && ! -f /config/server.xml ]]; then
    # If the config files aren't in /config/ then create a symbolic link from the target to /config/ so that
    # the resources will be available when starting the server
    ln -s $WLP_USER_DIR/servers/defaultServer/* /config/
fi

if [[ -f $WLP_USER_DIR/servers/defaultServer/resources/javametrics-agent.jar && ! -f /config/resources/javametrics-agent.jar ]]; then
    # If the config resource files aren't in /config/resources then create a symbolic link from the target to /config/resources so that
    # the resources will be available when starting the server
    ln -s $WLP_USER_DIR/servers/defaultServer/resources/* /config/resources
fi
