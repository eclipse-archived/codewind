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

export const needManualReset: any = {
    "docker": {
        "runningBuildQueue": false,
        "buildStatus": false
    },
    "nodejs": {
        "runningBuildQueue": true,
        "buildStatus": true
    },
};

export const projectCapabilities: any = {
    "docker": {
        "startModes": ["run"],
        "controlCommands": []
    },
    "nodejs": {
        "startModes": ["run", "debugNoInit"],
        "controlCommands": ["restart"]
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
    "docker": false
};

export const mavenProfileCapabilities: any = {
    "docker":  false,
};

export const exposedDebugPorts: any = {
    "docker": ["1000"]
};

export const defaultContextRoot: any = {
    "lagom": "/api/hello/you"
};

export const defaultHealthCheckEndPoint: any = {
    "go": "/",
    "python": "/"
};

export const oneExposedPortOnly: any = {
    "go": {
        "local": true,
        "kube": true
    },
    "python": {
        "local": true,
        "kube": true
    },
    "lagom": {
        "local": false,
        "kube": true
    }
};

export const defaultInternalPorts: any = {
    "go": "8000",
    "python": "5000",
    "lagom": "9000"
};

export const filesToUpdate: any = {
    "go": ["Dockerfile", "main.go"],
    "python": ["Dockerfile", "app.py"],
    "lagom": ["Dockerfile",
        "hello-api/src/main/java/com/example/rp/test/lagomendpoints/api/HelloService.java",
        "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloModule.java",
        "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloServiceImpl.java"]
};
