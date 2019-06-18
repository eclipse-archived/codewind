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
REGISTRY=$1
DEFAULT_REG_PORT=$2

# Tag all images
for x in $(docker images --filter "reference=microclimate*" --format "{{.Repository}}")
do
  docker tag $(docker images -q $x) $REGISTRY:$DEFAULT_REG_PORT/default/$x:latest
  if [ $? != 0 ] ; then
    echo "$x could not be tagged. Exiting..."
    exit 12;
  fi
done

# Remove any dangling tagged images
docker rmi $(docker images -q --filter "reference=$REGISTRY:$DEFAULT_REG_PORT/default/microclimate*" --filter "dangling=true")
docker images | grep "$REGISTRY"
