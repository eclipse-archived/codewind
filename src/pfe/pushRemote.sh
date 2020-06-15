#!/bin/bash

# To be run from the codewind/src/pfe directory

# Get the PFE pod in the current namespace
if [ -z "$1" ]; then
  echo "Please pass in the PFE Pod name as the parameter"
  exit 1
fi

PFE=$1

# PORTAL

# Refresh the docs directory
rm -r ./portal/docs
cp -r ../../docs ./portal

kubectl cp ./portal/config $PFE:/portal
kubectl cp ./portal/docs $PFE:/portal
kubectl cp ./portal/middleware $PFE:/portal
kubectl cp ./portal/modules $PFE:/portal
kubectl cp ./portal/routes $PFE:/portal
kubectl cp ./portal/server.js $PFE:/portal

# FILE-WATCHER

kubectl cp ./file-watcher/scripts $PFE:/file-watcher
