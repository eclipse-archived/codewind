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

source /file-watcher/scripts/constants.sh

echo "Removing dangling images for $1"
$IMAGE_COMMAND images -q -f label=imageName=$1 -f dangling=true | xargs $IMAGE_COMMAND rmi -f 2> /dev/null
exit 0
