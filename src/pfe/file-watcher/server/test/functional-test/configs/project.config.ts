/*******************************************************************************
 * Copyright (c) 2019 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/**
 * This file for different project specific (i.e liberty, spring, docker) capabaility configurations.
 */
import * as project from "../../../src/projects/Project";
import * as nodeProject from "../../../src/projects/nodejsProject";

// This config is to manual reset the running build queue and build status options for all project types.
// We currently need to do that because project that relies on script and IDC code does not follow the typescript code and need to be manually reset.
export const needManualReset: any = {
    "docker": {
        "buildStatus": false
    },
    "nodejs": {
        "buildStatus": true
    },
};

export const projectCapabilities: any = {
    "docker": {
        "local": project.defaultProjectCapabilities,
        "kube": project.defaultProjectCapabilities
    },
    "nodejs": {
        "local": {
            "startModes": ["run", "debugNoInit"],
            "controlCommands": ["restart"]
        },
        "kube": project.defaultProjectCapabilities
    }
};

export const startModes: Array<string> = ["run", "debug", "debugNoInit"];

export const restartCapabilities: any = {
    "docker": {
        [startModes[0]]: false,
        [startModes[1]]: false,
        [startModes[2]]: false,
    },
    "nodejs": {
        [startModes[0]]: true,
        [startModes[1]]: false,
        [startModes[2]]: true,
    },
};

export const debugCapabilities: any = {
    "docker": false,
    "nodejs": true
};

export const mavenProfileCapabilities: any = {
    "docker":  false,
    "nodejs": false
};

export const exposedDebugPorts = ["1000"];

export const defaultContextRoot: any = {
    "lagom": "/api/hello/you"
};

export const defaultHealthCheckEndPoint: any = {
    "go": "/",
    "lagom": "/",
    "python": "/",
    "nodejs": "/"
};

export const oneExposedPortOnly: any = {
    "go": {
        "local": true,
        "kube": true
    },
    "lagom": {
        "local": false,
        "kube": true
    },
    "python": {
        "local": true,
        "kube": true
    },
    "nodejs": {
        "local": false,
        "kube": true
    }
};

export const defaultInternalPorts: any = {
    "go": "8000",
    "lagom": "9000",
    "python": "5000",
    "nodejs": nodeProject.getDefaultAppPort()
};

export const filesToUpdate: any = {
    "go": ["Dockerfile", "main.go"],
    "lagom": ["Dockerfile",
        "hello-api/src/main/java/com/example/rp/test/lagomendpoints/api/HelloService.java",
        "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloModule.java",
        "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloServiceImpl.java"],
    "python": ["Dockerfile", "app.py"],
    "nodejs": ["Dockerfile", "server/server.js"]
};
