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
# Use yq to modify the user's chart in place.

source /file-watcher/scripts/kubeScripts/kube-utils.sh

deploymentFile=$1

function overwriteContainerArgsWithTail() {
    local argsPath="spec.template.spec.containers[0].args"
    yq w -i "$deploymentFile" -- "$argsPath" []
    yq w -i "$deploymentFile" -- "$argsPath"[0] "tail"
    yq w -i "$deploymentFile" -- "$argsPath"[1] "-F"
    yq w -i "$deploymentFile" -- "$argsPath"[2] "/output/container.log"
    yq w -i "$deploymentFile" -- "$argsPath"[3] "2>/dev/null"
}

overwriteContainerArgsWithTail
