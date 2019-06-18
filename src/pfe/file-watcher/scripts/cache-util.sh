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

PROJECT_ID=$1
COMMAND=$2
shift 2
FOLDER=/file-watcher/fwdata/projects/$PROJECT_ID
FILE=$FOLDER/cache.db

# Write the property map to the cache file
function writeCache() {
    mkdir -p $FOLDER
    rm -f -- $FILE
    for key in "${!propMap[@]}"; do
        echo "$key:${propMap[$key]}" >> $FILE
    done
}

# Read the property map in from the cache file
function readCache() {
    if [ -f $FILE ]; then
        while read line; do
            local IFS=:
            local PAIR=($line)
            local key="${PAIR[0]}"
            local value="${PAIR[1]}"
            if [ ! -z $key ] && [ ! -z $value ]; then
                propMap[$key]=$value
            fi
        done < "$FILE"
    fi
}

# Convert arguments to a map where the arguments are in the form of: key value key value ...
function getArgMap() {
    while [ ${#} -gt 1 ]; do
        local key=$1
        local value=$2
        shift 2
        argMap[$key]=$value
    done
}

if [ "$COMMAND" == "getChanged" ]; then
    # Given a list of keys and values, return the keys who's values have changed and update the
    # cache with the new values
    declare -A argMap
    getArgMap "$@" $argMap
    declare -A propMap
    readCache $propMap
    result=()
    for key in ${!argMap[@]}; do
        newValue=${argMap[$key]}
        oldValue=${propMap[$key]}
        if [ "$newValue" != "$oldValue" ]; then
            propMap[$key]=$newValue
            result+=($key)
        fi
    done
    writeCache $propMap
    echo ${result[@]}
elif [ "$COMMAND" == "getValue" ]; then
    # Get the value for the given key
    key=$1
    declare -A propMap
    readCache $propMap
    echo ${propMap[$key]}
elif [ "$COMMAND" == "update" ]; then
    # Given a list of keys and values, update the cache
    declare -A argMap
    getArgMap "$@" $argMap
    declare -A propMap
    readCache $propMap
    for key in ${!argMap[@]}; do
        propMap[$key]=${argMap[$key]}
    done
    writeCache $propMap
fi
