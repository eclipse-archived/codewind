#!/bin/bash
#
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

# On intel, uname -m returns "x86_64", but the convention for IBM docker images is "amd64"
# This script is just used where we'd rather use `uname -m` in shell scripts.
ARCH=`uname -m`
if [ "$ARCH" == "x86_64" ]; then
  echo "amd64"
else
  echo $ARCH
fi