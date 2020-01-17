#!/bin/bash

NPM_CMD='npm'
if [ ! -z "$ENABLE_CODE_COVERAGE" ] && [ "$ENABLE_CODE_COVERAGE" == "true" ]; then
  NPM_CMD='npx nyc@15.0.0 npm'
  echo "Running with code coverage enabled through nyc ($NPM_CMD)"
fi

if [ ! -z "$NODE_ENV" ] && [ "$NODE_ENV" == "development" ]; then
  echo "Found node environment set to dev. Running in development mode."
  $NPM_CMD run dev
else
  echo "Found node environment set to prod. Running in production mode."
  $NPM_CMD run prod
fi
