#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

echo -e "${BLUE}Removing test projects... ${RESET}\n"
rm -rf ./test/resources/SVTPythonTemplate ./test/resources/nodeExpressTemplate ./test/resources/springJavaTemplate ./test/resources/swiftTemplate ./test/resources/javaMicroProfileTemplate

echo -e "${BLUE}Removing test log directory... ${RESET}\n"
rm -rf .logs/