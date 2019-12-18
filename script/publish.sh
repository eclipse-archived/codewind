#!/bin/bash
#
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

# Pushes the Codewind image up to the specified registry

set -eu

if [ "$#" -lt 2 ]; then
    echo "usage: $0 <docker registry/image name> <tag>"
    exit 1
fi

IMAGE_NAME=$1
TAG=${2:-latest}

docker push $IMAGE_NAME:$TAG
