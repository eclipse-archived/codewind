#!/bin/bash

if [ ! -z "$NODE_ENV" ] && [ "$NODE_ENV" == "development" ]; then
  echo "Found node environment set to dev. Running in development mode."
  npm run dev
else
  echo "Found node environment set to prod. Running in production mode."
  npm run prod
fi
