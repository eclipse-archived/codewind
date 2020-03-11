#!/bin/bash
#*******************************************************************************
# Copyright (c) 2020 IBM Corporation and others.
# All rights reserved. This program and the accompanying materials
# are made available under the terms of the Eclipse Public License v2.0
# which accompanies this distribution, and is available at
# http://www.eclipse.org/legal/epl-v20.html
#
# Contributors:
#     IBM Corporation - initial API and implementation
#*******************************************************************************

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
INITIAL_DIR=$(pwd)

source $DIR/utils.sh
cd $INITIAL_DIR

function buildPFE() {
    echo -e "${BLUE}>> Building PFE on local ... ${RESET}"
    cd $CW_DIR

    $CW_DIR/stop.sh
    checkExitCode $? "Codewind failed to stop." true

    $CW_DIR/run.sh
    checkExitCode $? "Codewind failed to start." true

    cd $INITIAL_DIR
}

function downloadCwctl() {
    echo -e "${BLUE}>> Downloading latest installer ... ${RESET}"
    EXECUTABLE_NAME="cwctl"
    HOST_OS=$(uname -a)
    if [[ "$HOST_OS" =~ "Darwin" ]]; then
        extension="macos"
    elif [[ "$HOST_OS" =~ "Linux" ]]; then
        extension="linux"
    fi
    echo "Extension is $extension"
    if [ ! -z $CWCTL_VERSION ]; then
        CWCTL_INSTALL_TARGET="$CWCTL_VERSION"
    else
        CWCTL_INSTALL_TARGET="master"
    fi
    if [ ! -z $EXECUTABLE_PATH ]; then
        curl -X GET http://download.eclipse.org/codewind/codewind-installer/$CWCTL_INSTALL_TARGET/latest/cwctl-$extension --output $EXECUTABLE_PATH/$EXECUTABLE_NAME
    else
        curl -X GET http://download.eclipse.org/codewind/codewind-installer/$CWCTL_INSTALL_TARGET/latest/cwctl-$extension --output $EXECUTABLE_NAME
    fi
    
    checkExitCode $? "Failed to download latest installer."

    echo -e "${BLUE}>> Giving executable permission to installer ... ${RESET}"
    chmod +x $EXECUTABLE_NAME
    checkExitCode $? "Failed to give correct permission to run installer."
}

function createProject() {
   ./$EXECUTABLE_NAME project create --url $1 --path $2
}

buildPFE
downloadCwctl

echo -e "${BLUE}>> Creating test projects directory ... ${RESET}"
rm -rf $PROJECT_DIR
mkdir -p $PROJECT_DIR
checkExitCode $? "Failed to create test projects directory."

CTR=0
# Read project git config
echo -e "${BLUE}Creating projects to $PROJECT_DIR. ${RESET}"
while IFS='\n' read -r LINE; do
    PROJECT_CLONE[$CTR]=$LINE
    let CTR++
done < "$PROJECTS_CLONE_DATA_FILE"
        
# Clone projects to workspace
for i in "${PROJECT_CLONE[@]}"; do
    PROJECT_NAME=$(echo $i | cut -d "=" -f 1)
    PROJECT_URL=$(echo $i | cut -d "=" -f 2)

    echo -e "${BLUE}>> Creating project $PROJECT_NAME from $PROJECT_URL in "$PROJECT_DIR/$PROJECT_NAME" ${RESET}"
    createProject $PROJECT_URL "$PROJECT_DIR/$PROJECT_NAME"
    checkExitCode $? "Failed to created project $PROJECT_NAME."
done
