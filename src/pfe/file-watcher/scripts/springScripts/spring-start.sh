#!/bin/bash
PROJECT_NAME=$1
START_MODE=$2
DEBUG_PORT=$3

echo "PROJECT_NAME=$PROJECT_NAME"
echo "START_MODE=$START_MODE"
echo "DEBUG_PORT=$DEBUG_PORT"

# Start the application
echo "Starting Spring application: $PROJECT_NAME in mode: $START_MODE"
if [ "$START_MODE" == "run" ]; then
    java -jar /root/app.jar >> /var/log/app.log 2>&1 &
elif [ "$START_MODE" == "debugNoInit" ]; then
    java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=$DEBUG_PORT -jar /root/app.jar >> /var/log/app.log 2>&1 &
elif [ "$START_MODE" == "debug" ]; then
    java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=$DEBUG_PORT -jar /root/app.jar >> /var/log/app.log 2>&1 &
fi