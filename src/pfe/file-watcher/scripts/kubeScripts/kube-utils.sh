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
# Commonly used functions in K8

# getIndex returns the number of entries at a given yaml path in the deployment yaml file.
function getIndex() {
    local filename="$1"
    local yamlPath="$2"
    local values=$( yq r $filename -- "$yamlPath" )
    local index=0
    if [[ "$values" != "null" ]]; then
        index=$( echo "$values" | wc -l)
    fi
    echo -e $index
}
