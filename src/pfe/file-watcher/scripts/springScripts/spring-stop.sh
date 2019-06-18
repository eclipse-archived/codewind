#!/bin/bash
PROJECT_NAME=$1

echo "PROJECT_NAME=$PROJECT_NAME"

# Kill the server running the springboot jar
echo "Stopping Spring application: $PROJECT_NAME"
pkill java