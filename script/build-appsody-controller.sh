# ----------------------------------------------------------------------------
#
# Package	: Thorntail
# Version	: latest
# Source repo	: https://github.com/thorntail/thorntail.git
# Tested on	: rhel_7.6
# Script License: Apache License, Version 2 or later
# Maintainer	: Vrushali Inamdar <vrushali.inamdar@ibm.com>
#
# Disclaimer: This script has been tested in root mode on given
# ==========  platform using the mentioned version of the package.
#             It may not work as expected with newer versions of the
#             package and/or distribution. In such case, please
#             contact "Maintainer" of this script.
#
# ----------------------------------------------------------------------------

#!/bin/bash

wrkdir=`pwd`

cd $wrkdir/src/pfe/extensions/codewind-appsody-extension/bin

appsody_version=0.5.3
curl -fsSL https://github.com/appsody/appsody/releases/download/$appsody_version/appsody-$appsody_version-linux-ppc64le.tar.gz -o appsody-$appsody_version-linux-ppc64le.tar.gz
tar xzf appsody-$appsody_version-linux-ppc64le.tar.gz "appsody"

# Build PhantomJS binary file from source code on Power
mkdir -p $HOME/go/bin
mkdir -p $HOME/go/pkg
mkdir -p $HOME/go/src/github.com/appsody

cd $HOME/go/src/github.com/appsody

git clone https://github.com/appsody/controller
cd controller
go build

FILE=./controller
if [ -f "$FILE" ]; then
    echo "$FILE binary is generated successfully."
    cp $FILE $wrkdir/src/pfe/extensions/codewind-appsody-extension/bin/appsody-controller
    echo "Copied $FILE to $wrkdir/src/pfe/extensions/codewind-appsody-extension/bin directory."
fi

