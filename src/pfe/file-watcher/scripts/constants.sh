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

# General constants

export APP_STATE_STARTING="starting"
export APP_STATE_STARTED="started"
export APP_STATE_STOPPING="stopping"
export APP_STATE_STOPPED="stopped"
export APP_STATE_UNKNOWN="unknown"

export BUILD_STATE_INPROGRESS="inProgress" 
export BUILD_STATE_SUCCESS="success"
export BUILD_STATE_FAILED="failed"

# Detailed build messages
export BUILD_IMAGE_INPROGRESS_MSG="Building application container image for" # :NLS
export BUILD_BUILDIMAGE_INPROGRESS_MSG="Building build container image" # :NLS
export COMPILE_INPROGRESS_MSG="Compiling application" # :NLS
export BUILD_IMAGE_SUCCESS_MSG="Build image stage succeeded for" # :NLS
export BUILD_IMAGE_FAILED_MSG="Build image stage failed for" # :NLS
export MAVEN_BUILD_INPROGRESS_MSG="Running maven build for" # :NLS
export MAVEN_BUILD_SUCCESS_MSG="Maven build state succeeded for" # :NLS
export MAVEN_BUILD_FAILED_MSG="Maven build stage failed for" # :NLS

if [ "$IN_K8" == "true" ]; then
	export IMAGE_COMMAND="buildah"
	export BUILD_COMMAND="bud"
else
	export IMAGE_COMMAND="docker"
	export BUILD_COMMAND="build"
fi