#!/bin/bash

# Get the PFE pod in the current namespace
PFE=$(kubectl get pod -l app=codewind-pfe --output=jsonpath={.items..metadata.name})

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
