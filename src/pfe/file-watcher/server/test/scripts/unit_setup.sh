#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
RESET='\033[0m'

PROJECT_URLS=()
PROJECT_URLS[0]="https://github.com/microclimate-dev2ops/SVTPythonTemplate"
PROJECT_URLS[1]="https://github.com/microclimate-dev2ops/springJavaTemplate"
PROJECT_URLS[2]="https://github.com/microclimate-dev2ops/javaMicroProfileTemplate"
PROJECT_URLS[3]="https://github.com/microclimate-dev2ops/nodeExpressTemplate"
PROJECT_URLS[4]="https://github.com/microclimate-dev2ops/swiftTemplate"


for PROJECT_URL in ${PROJECT_URLS[@]}; do
    echo -e "${BLUE}Cloning $PROJECT_URL. ${RESET}\n"
    git clone $PROJECT_URL
done