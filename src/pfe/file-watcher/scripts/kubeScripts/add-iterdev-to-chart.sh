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
# Adds the required iterative-dev functionality to the Helm chart.
# yq command format:
# `yq <operation> <flags> <file> -- <yaml path> <value>`

source /file-watcher/scripts/kubeScripts/kube-utils.sh

deploymentFile=$1
projectName=$2
entrypoint=$3
logFolder=$4

# Adds the entrypoint command and arg override to the deployment file
function addEntrypoint() {
    # Overwrite the entrypoint command for the container.
    # yq doesn't let us add multiple array values at once, so need to add them separately
    local commandPath="spec.template.spec.containers[0].command"
    yq w -i $deploymentFile -- $commandPath []
    yq w -i $deploymentFile -- $commandPath[0] "/bin/bash"
    yq w -i $deploymentFile -- $commandPath[1] "-c"
    yq w -i $deploymentFile -- $commandPath[2] "--"

    # Overwrite the entrypoint args for the container
    local argPath="spec.template.spec.containers[0].args"
    yq w -i $deploymentFile -- $argPath []
    yq w -i $deploymentFile -- $argPath[0] $entrypoint
}

# Adds in the volumes to the deployment and container
function addVolumeMount() {
    # Add in the volume mount to the container (note the first '+' is not a typo, it's required to append to the array)
    local volumeMountPath="spec.template.spec.containers[0].volumeMounts"
    local index=$(getIndex $deploymentFile $volumeMountPath[*].name)
    yq w -i $deploymentFile -- $volumeMountPath[+].name shared-workspace
    yq w -i $deploymentFile -- $volumeMountPath[$index].mountPath /codewind-workspace/
    yq w -i $deploymentFile -- $volumeMountPath[$index].subPath "$CHE_WORKSPACE_ID/projects"

    # Add the persistent volume to the deployment
    local volumesPath="spec.template.spec.volumes"
    local index=$(getIndex $deploymentFile $volumesPath[*].name)
    yq w -i $deploymentFile -- $volumesPath[+].name shared-workspace
    yq w -i $deploymentFile -- $volumesPath[$index].persistentVolumeClaim.claimName $PVC_NAME
}

function addEnvVars() {
    # Append the project name environment variable
    local envPath="spec.template.spec.containers[0].env"
    index=$(getIndex $deploymentFile "$envPath[*].name")
    yq w -i $deploymentFile -- $envPath[+].name PROJECT_NAME
    yq w -i $deploymentFile -- $envPath[$index].value $projectName

    index1=$(getIndex $deploymentFile "$envPath[*].name")
    yq w -i $deploymentFile -- $envPath[+].name LOG_FOLDER
    yq w -i $deploymentFile -- $envPath[$index1].value $logFolder

    index2=$(getIndex $deploymentFile "$envPath[*].name")
    yq w -i $deploymentFile -- $envPath[+].name IN_K8
    yq w -i $deploymentFile -- $envPath[$index2].value "\"true\""
}

addEntrypoint

addVolumeMount

addEnvVars
