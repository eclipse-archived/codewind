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

CONTAINER_NAME=$1
IN_K8=$2

if [[ "$IN_K8" == "true" ]]; then
	echo "Killing app log process"
	pgrep -f "kubectl logs -f $CONTAINER_NAME" | xargs kill -9
fi
