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
# Use yq to find the file for the specified Kube resource in a given Helm chart
# Keep in mind Miroclimate currently restricts 1 Deployment / Service / etc per project, so only return the first occurrence

chartFolder=$1
kubeResource=$2
templatesFolder=$chartFolder/templates

if [[ -d $templatesFolder ]]; then
    # Check the default file name for some resources first, to prevent an unnecessary search if it's not needed
    if [[ $kubeResource == "Deployment" && -f $templatesFolder/deployment.yaml ]]; then
        echo $templatesFolder/deployment.yaml
        exit
    fi

    if [[ $kubeResource == "Service" && -f $templatesFolder/service.yaml ]]; then
        echo $templatesFolder/service.yaml
        exit
    fi

    # If we couldn't find the resource under the default name, then loop over the template files and try to find it
    for filename in $templatesFolder/*; do
        kind=$( yq r $filename -- kind )
        if [[ $kind == $kubeResource ]]; then
            echo $filename
        fi
    done
fi