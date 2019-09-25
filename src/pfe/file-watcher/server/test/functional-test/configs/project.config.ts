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
 * This file for different project specific (i.e liberty, spring, docker) capability configurations.
 */
import * as project from "../../../src/projects/Project";
import * as libertyProject from "../../../src/projects/libertyProject";
import * as nodeProject from "../../../src/projects/nodejsProject";
import * as springProject from "../../../src/projects/springProject";
import * as swiftProject from "../../../src/projects/swiftProject";

// This config is to manual reset the running build queue and build status options for all project types.
// We currently need to do that because project that relies on script and IDC code does not follow the typescript code and need to be manually reset.
export const needManualReset: any = {
    "docker": {
        "appStatus": false,
        "buildStatus": false
    },
    "nodejs": {
        "appStatus": true,
        "buildStatus": true
    },
    "liberty": {
        "appStatus": true,
        "buildStatus": true
    },
    "spring": {
        "appStatus": true,
        "buildStatus": true,
    },
    "swift": {
        "appStatus": false,
        "buildStatus": true
    }
};

// project specific capability settings: start modes and control commands
export const projectCapabilities: any = {
    "docker": {
        "local": project.defaultProjectCapabilities,
        "kube": project.defaultProjectCapabilities
    },
    "liberty": {
        "local": {
            "startModes": ["run", "debug"],
            "controlCommands": ["restart"]
        },
        "kube": project.defaultProjectCapabilities
    },
    "nodejs": {
        "local": {
            "startModes": ["run", "debugNoInit"],
            "controlCommands": ["restart"]
        },
        "kube": project.defaultProjectCapabilities
    },
    "spring": {
        "local": {
            "startModes": ["run", "debug", "debugNoInit"],
            "controlCommands": ["restart"]
        },
        "kube": project.defaultProjectCapabilities
    },
    "swift": {
        "local": project.defaultProjectCapabilities,
        "kube": project.defaultProjectCapabilities
    }
};

// auto build enable/disable event capabilities: some projects emit the project changed event and some don't do anything
export const autoBuildEventCapabailities: any = {
    "docker": false,
    "liberty": false,
    "nodejs": true,
    "spring": false,
    "swift": false
};

// list of start modes available in Turbine
export const startModes: Array<string> = ["run", "debug", "debugNoInit"];

// project specific restart capabilities depending on the above start modes
export const restartCapabilities: any = {
    "docker": [],
    "liberty": [startModes[0], startModes[1]],
    "nodejs": [startModes[0], startModes[2]],
    "spring": startModes,
    "swift": []
};

// project specific debug capabilities
export const debugCapabilities: any = {
    "docker": false,
    "liberty": true,
    "nodejs": true,
    "spring": true,
    "swift": false,
};

// project specific maven profile capabilities
export const mavenProfileCapabilities: any = {
    "docker":  false,
    "liberty": true,
    "nodejs": false,
    "spring": true,
    "swift": false
};

// list of mocked exposed debug ports
export const exposedDebugPorts = ["1000"];

// default context roots for projects
export const defaultContextRoot: any = {
    "lagom": "/api/hello/you"
};

// default health check endpoints for projects
export const defaultHealthCheckEndPoint: any = {
    "go": "/",
    "lagom": "/",
    "python": "/",
    "liberty": "/",
    "nodejs": "/",
    "spring": "/",
    "swift": "/"
};

// project specific setting for projects that only expose one app port
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
    "liberty": {
        "local": false,
        "kube": false
    },
    "nodejs": {
        "local": false,
        "kube": true
    },
    "spring": {
        "local": false,
        "kube": true
    },
    "swift": {
        "local": true,
        "kube": true
    }
};

// project specific setting for default app ports
export const defaultInternalPorts: any = {
    "go": "8000",
    "lagom": "9000",
    "python": "5000",
    "liberty": libertyProject.getDefaultAppPort(),
    "nodejs": nodeProject.getDefaultAppPort(),
    "spring": springProject.getDefaultAppPort(),
    "swift": swiftProject.getDefaultAppPort()
};

// project specific setting for default app debug ports
export const defaultInternalDebugPorts: any = {
    "liberty": libertyProject.getDefaultDebugPort(),
    "nodejs": nodeProject.getDefaultDebugPort(),
    "spring": springProject.getDefaultDebugPort(),
};

// project specific settings to mark the main files
export const filesToUpdate: any = {
    "go": ["Dockerfile", "main.go"],
    "lagom": ["Dockerfile",
        "hello-api/src/main/java/com/example/rp/test/lagomendpoints/api/HelloService.java",
        "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloModule.java",
        "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloServiceImpl.java"],
    "python": ["Dockerfile", "app.py"],
    "liberty": ["Dockerfile", "src/main/java/application/rest/v1/Example.java"],
    "nodejs": ["Dockerfile", "server/server.js"],
    "spring": ["Dockerfile", "src/main/java/application/rest/v1/Example.java"],
    "swift": ["Dockerfile", "Sources/Application/Routes/HealthRoutes.swift"],
};
