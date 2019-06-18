#!/usr/bin/env bash

test_name="hello-impl"
source ../../../bin/test-common.sh
dockerfile="${test_name}/target/docker/${test_name}/1.0/build/Dockerfile"

if [ -f $dockerfile ]; then
    check $dockerfile 'com.lightbend.rp.app-name="hello-impl"'
    check $dockerfile 'com.lightbend.rp.app-type="lagom"'
    check $dockerfile 'com.lightbend.rp.modules.common.enabled="true"'
    check $dockerfile 'com.lightbend.rp.modules.akka-management.enabled="true"'
    check $dockerfile 'com.lightbend.rp.modules.service-discovery.enabled="true"'
    check $dockerfile 'com.lightbend.rp.modules.akka-cluster-bootstrap.enabled="true"'

    check $dockerfile 'com.lightbend.rp.endpoints.0.protocol="http"'
    check $dockerfile 'com.lightbend.rp.endpoints.0.ingress.0.type="http"'
    check $dockerfile 'com.lightbend.rp.endpoints.0.ingress.0.paths.0="/api/hello/"'
    check $dockerfile 'com.lightbend.rp.endpoints.0.ingress.0.ingress-ports.0="80"'
    check $dockerfile 'com.lightbend.rp.endpoints.0.ingress.0.ingress-ports.1="443"'
    check $dockerfile 'com.lightbend.rp.endpoints.1.name="akka-remote"'
    check $dockerfile 'com.lightbend.rp.endpoints.1.protocol="tcp"'
    check $dockerfile 'com.lightbend.rp.endpoints.2.name="akka-mgmt-http"'
    check $dockerfile 'com.lightbend.rp.endpoints.2.protocol="tcp"'

else
    echo "File $dockerfile not found"
    exit 1
fi
