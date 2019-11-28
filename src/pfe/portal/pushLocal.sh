#!/bin/bash

docker cp config/. codewind-pfe:/portal/config
docker cp docs/. codewind-pfe:/portal/docs
docker cp middleware/. codewind-pfe:/portal/middleware
docker cp modules/. codewind-pfe:/portal/modules
docker cp routes/. codewind-pfe:/portal/routes
docker cp server.js codewind-pfe:/portal/server.js
