#!/usr/bin/env sh
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

# $1 is the path given to npm test. This will run all tests from this directory recursively. 
# This is being passed in from test.sh via the package.json (e.g. npm run test /release)
# If not set it defaults to all tests in 'src'

start=$(date +%F_%T)
echo "Tests started at ${start}"
node_modules/.bin/nyc node_modules/.bin/mocha ${@:-src} --recursive --reporter mocha-multi-reporters --reporter-options configFile=scripts/config.json --exit
rc=$?
end=$(date +%F_%T)
echo -e "\nTests finished at ${end}"
echo "\nView coverage report in browser at ${PWD}/coverage/index.html\n"

exit $rc
