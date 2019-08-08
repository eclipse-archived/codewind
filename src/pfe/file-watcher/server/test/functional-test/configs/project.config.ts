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
export const projectCapabilities: any = {
    "docker": {
        "startModes": ["run"],
        "controlCommands": []
    }
};

export const restartCapabilities: any = {
    "docker": false
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

export const filesToUpdate: any = {
    "go": ["Dockerfile", "main.go"],
    "python": ["Dockerfile", "app.py"],
    "lagom": ["Dockerfile",
        "hello-api/src/main/java/com/example/rp/test/lagomendpoints/api/HelloService.java",
        "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloModule.java",
        "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloServiceImpl.java"]
};
