#!/bin/bash

OS=$(uname -a | awk '{print $1;}')

# Test for Windows Host OS
isMicroclimateRunningOnWindows() {
   [[ $(uname -r) =~ Microsoft$ ]]
}

if [ $# -eq 0 ]; then
	echo
	echo "No arguments provided. First argument should be path to web root."
	echo
	exit 1
fi

echo \* Mounting at $1

if [ $OS == "Darwin" ] || isMicroclimateRunningOnWindows; then
   docker stop apache
   docker rm apache
   docker run -dit --name apache --restart always -p 80:80 -v `cd $1;pwd`:/usr/local/apache2/htdocs/ httpd:2.4
elif [ $OS == "Linux" ]; then
   sudo docker stop apache
   sudo docker rm apache
   sudo docker run -dit --name apache --restart always -p 80:80 -v `cd $1;pwd`:/usr/local/apache2/htdocs/ httpd:2.4
fi
