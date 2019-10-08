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
serviceFile=$2
releaseName=$3
projectID=$4

function addOwnerReference() {
    local filename="$1"
    local index=$(getIndex $filename metadata.ownerReferences[*].apiVersion)
    yq w -i $filename -- metadata.ownerReferences[+].apiVersion apps/v1
    yq w -i $filename -- metadata.ownerReferences[$index].blockOwnerDeletion true
    yq w -i $filename -- metadata.ownerReferences[$index].controller true
    yq w -i $filename -- metadata.ownerReferences[$index].kind Deployment
    yq w -i $filename -- metadata.ownerReferences[$index].name $PFE_NAME
    yq w -i $filename -- metadata.ownerReferences[$index].uid $PFE_UID
}

export PFE_NAME=$( kubectl get deploy --selector=app=codewind-pfe,codewindWorkspace=$CHE_WORKSPACE_ID -o jsonpath='{.items[0].metadata.name}' )
export PFE_UID=$( kubectl get deploy --selector=app=codewind-pfe,codewindWorkspace=$CHE_WORKSPACE_ID -o jsonpath='{.items[0].metadata.uid}' )

# Set the name of the deployment and service to the release name
concatenatedReleaseName=$(echo $releaseName | head -c 62 | sed 's/\-$//')
yq w -i $deploymentFile -- metadata.name $concatenatedReleaseName
yq w -i $serviceFile -- metadata.name $concatenatedReleaseName

# Add the missing labels to the deployment
yq w -i $deploymentFile -- metadata.labels.release $releaseName
yq w -i $deploymentFile -- spec.template.metadata.labels.release $releaseName

# Add the project ID label to the service and deployment
yq w -i $serviceFile -- metadata.labels.projectID $projectID
yq w -i $deploymentFile -- metadata.labels.projectID $projectID
yq w -i $deploymentFile -- spec.template.metadata.labels.projectID $projectID

# Add owner reference for deletion when workspace is deleted
addOwnerReference $deploymentFile

# Add the serviceAccount name to the deployment
yq w -i $deploymentFile -- spec.template.spec.serviceAccountName $SERVICE_ACCOUNT_NAME

# Add the labels to the service
yq w -i $serviceFile -- metadata.labels.release $releaseName

# Add owner reference for deletion when workspace is deleted
addOwnerReference $serviceFile
