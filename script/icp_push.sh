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
# Push the tagged images to ICP

for x in $(docker images --format "{{.Repository}}" | grep "$REGISTRY:$DEFAULT_REG_PORT.*microclimate")
do
  docker push $x
  if [ $? != 0 ] ; then
    echo "$x could not be pushed. Exiting..."
    exit 12;
  fi
done
