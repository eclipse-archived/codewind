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

NYC_CMD=''
if [ "$ENABLE_COVERAGE" = "true" ]; then
    echo "Running with code coverage enabled"
    NYC_CMD=node_modules/.bin/nyc
fi

cp -r ../docs ../src/pfe/portal/docs
if [ $? != 0 ]; then
    echo "Error copying docs directory to Portal directory (openapi.yaml)"
    exit 1;
fi

$NYC_CMD node_modules/.bin/mocha ${@:-src} --recursive --reporter mocha-multi-reporters --reporter-options configFile=scripts/config.json --exit
rc=$?
end=$(date +%F_%T)
echo "\nTests finished at ${end}"

if [ "$ENABLE_COVERAGE" = "true" ]; then
    echo "\nView coverage report in browser at ${PWD}/coverage/index.html\n"
fi

exit $rc
