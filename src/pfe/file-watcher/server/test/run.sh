#!/usr/bin/env bash

# Colors for success and error messages
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\e[36m'
YELLOW='\e[33m'
MAGENTA='\e[35m'
RESET='\033[0m'

CODEWIND_REPO=git@github.com:eclipse/codewind.git
RELEASE_BRANCH="master"
TEST_ENV="local"
RELEASE_DIR="performance-test-codewind"

function usage {
    me=$(basename $0)
    cat <<EOF
Usage: $me: [-<option letter> <option value> | -h]
Options:
    --release       The release branch to use. Default: master
    --environment   The test environment. Default: local
    -h | --help     Display the man page
EOF
}

function displayMsg() {
	exit_code=$1
	error_msg=$2
    exit=$3

	if [[ $exit_code -eq 0 ]]; then
		echo -e "${GREEN}✔ Done. ${RESET}\n"
	else
		echo -e "${RED}✖ $error_msg  ${RESET}\n"
		if [[ $exit == true ]]; then
            exit 1
        fi
	fi
}

while :; do
    case $1 in
        --release=?*)
        RELEASE_BRANCH=${1#*=}
        ;;
        -h|--help)
        usage
        exit
        ;;
        *) break
    esac
    shift
done

CURR_DIR=$(pwd)

echo -e "${CYAN}> Cloning release branch ${RESET}"
rm -rf $RELEASE_DIR
git clone $CODEWIND_REPO -b "$RELEASE_BRANCH" $RELEASE_DIR
displayMsg $? "Failed to clone from release branch." true

echo -e "${CYAN}> Switching to release directory ${RESET}"
cd $RELEASE_DIR
displayMsg $? "Failed to switch release directory." true

echo -e "${CYAN}> Starting codewind ${RESET}"
./run.sh
displayMsg $? "Failed to start codewind." true

cd $CURR_DIR

for run in {1..10}
do
    echo -e "${BLUE}Run number: $run ${RESET}"
    docker system prune -af
    ./test.sh
done
