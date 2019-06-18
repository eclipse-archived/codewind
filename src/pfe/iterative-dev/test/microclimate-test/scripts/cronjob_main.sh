#!/bin/bash

TEST_RELEASE=$1
TEST_TYPE=$2
MC_INSTALL_ARCH=$3
CACHE_OPTION=$4
RESULT_FOLDER=""

if [[ $CACHE_OPTION ]]; then
    /root/cronjob_microclimate.sh $TEST_RELEASE $TEST_TYPE $MC_INSTALL_ARCH $CACHE_OPTION >> console-cache.log 2>&1
    RESULT_FOLDER=`ls /root/microclimate_results | tail -n 1`
    echo "Result folder is $RESULT_FOLDER"
    cp /root/console-cache.log /root/microclimate_results/$RESULT_FOLDER
else
    /root/cronjob_microclimate.sh $TEST_RELEASE $TEST_TYPE $MC_INSTALL_ARCH >> console.log 2>&1
    RESULT_FOLDER=`ls /root/microclimate_results | tail -n 1`
    echo "Result folder is $RESULT_FOLDER"
    mv /root/console-cache.log /root/microclimate_results/$RESULT_FOLDER
    mv /root/console.log /root/microclimate_results/$RESULT_FOLDER
fi