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

# Wrapper for helm
if [[ $KUBE_NAMESPACE && "$1" == "install" ]]; then
    # If using alt-namespace, need to specify namespace flag for helm install
    _helm "$@" --tls --namespace $KUBE_NAMESPACE
elif [[ $KUBE_NAMESPACE && "$1" == "template" ]]; then 
    # helm template can't have the tls flag
    _helm "$@" --namespace $KUBE_NAMESPACE
else
    _helm "$@" --tls
fi