#!/bin/bash

# Refresh the docs directory
rm -r ./docs
cp -r ../../../docs ./

docker cp config/. codewind-pfe:/portal/config
docker cp docs/. codewind-pfe:/portal/docs
docker cp middleware/. codewind-pfe:/portal/middleware
docker cp modules/. codewind-pfe:/portal/modules
docker cp routes/. codewind-pfe:/portal/routes
docker cp controllers/. codewind-pfe:/portal/controllers
docker cp server.js codewind-pfe:/portal/server.js
