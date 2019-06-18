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

# Kubernetes can have a bad habit of not clearing out terminating pods
# Since the Kubernetes REST API doesn't distinguish between Running and Terminating pods, this needs to be done in bash
# This script takes in a release name and deletes any terminating pods with that label

release=$1
pods=$( kubectl get po --selector=release=$release | grep 'Terminating' | cut -d ' ' -f 1 )
if [[ ! -z $pods ]]; then
    # Delete the terminating pods
    kubectl delete po --force --grace-period=0 $pods
fi