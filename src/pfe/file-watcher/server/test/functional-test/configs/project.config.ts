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

import { codewindTemplates, projecLanguges } from "./app.config";

/**
 * Please note: This is the project config file. The configs are set in the order of template -> projectLang in an object. If a key is missing by default it means that specific functionality for that key is not supported.
 */

// This config is to manual reset the running build queue and build status options for all project types.
// We currently need to do that because project that relies on script and IDC code does not follow the typescript code and need to be manually reset.
export const needManualReset: any = {
    [codewindTemplates.default]: {
        [projecLanguges.liberty]: {
            "appStatus": true,
            "buildStatus": true
        },
        [projecLanguges.nodejs]: {
            "appStatus": true,
            "buildStatus": true
        },
        [projecLanguges.spring]: {
            "appStatus": true,
            "buildStatus": true,
        },
        [projecLanguges.swift]: {
            "appStatus": false,
            "buildStatus": true
        }
    },
    [codewindTemplates.odo]: {
        [projecLanguges.nodejs]: {
            "appStatus": false,
            "buildStatus": true
        },
        [projecLanguges.perl]: {
            "appStatus": false,
            "buildStatus": true
        },
        [projecLanguges.python]: {
            "appStatus": false,
            "buildStatus": true
        }
    }
};

// project specific capability settings: start modes and control commands
export const projectCapabilities: any = {
    [codewindTemplates.default]: {
        [projecLanguges.liberty]: {
            "local": {
                "startModes": ["run", "debug"],
                "controlCommands": ["restart"]
            },
            "kube": project.defaultProjectCapabilities
        },
        [projecLanguges.nodejs]: {
            "local": {
                "startModes": ["run", "debugNoInit"],
                "controlCommands": ["restart"]
            },
            "kube": project.defaultProjectCapabilities
        },
        [projecLanguges.spring]: {
            "local": {
                "startModes": ["run", "debug", "debugNoInit"],
                "controlCommands": ["restart"]
            },
            "kube": project.defaultProjectCapabilities
        },
        [projecLanguges.swift]: {
            "local": project.defaultProjectCapabilities,
            "kube": project.defaultProjectCapabilities
        }
    },
    [codewindTemplates.docker]: {
        [projecLanguges.go]: {
            "local": project.defaultProjectCapabilities,
            "kube": project.defaultProjectCapabilities
        },
        [projecLanguges.lagom]: {
            "local": project.defaultProjectCapabilities,
            "kube": project.defaultProjectCapabilities
        },
        [projecLanguges.python]: {
            "local": project.defaultProjectCapabilities,
            "kube": project.defaultProjectCapabilities
        }
    },
    [codewindTemplates.odo]: {
        [projecLanguges.nodejs]: {
            "kube": project.defaultProjectCapabilities
        },
        [projecLanguges.perl]: {
            "kube": project.defaultProjectCapabilities
        },
        [projecLanguges.python]: {
            "kube": project.defaultProjectCapabilities
        }
    }
};

// auto build enable/disable event capabilities: some projects emit the project changed event and some don't do anything
export const autoBuildEventCapabailities: any = {
    [codewindTemplates.default]: {
        [projecLanguges.nodejs]: true,
    }
};

// list of start modes available in Turbine
export const startModes: Array<string> = ["run", "debug", "debugNoInit"];

// project specific restart capabilities depending on the above start modes
export const restartCapabilities: any = {
    [codewindTemplates.default]: {
        [projecLanguges.liberty]: [startModes[0], startModes[1]],
        [projecLanguges.nodejs]: [startModes[0], startModes[2]],
        [projecLanguges.spring]: startModes,
    }
};

// project specific debug capabilities
export const debugCapabilities: any = {
    [codewindTemplates.default]: {
        [projecLanguges.liberty]: true,
        [projecLanguges.nodejs]: true,
        [projecLanguges.spring]: true,
    }
};

// project specific maven profile capabilities
export const mavenProfileCapabilities: any = {
    [codewindTemplates.default]: {
        [projecLanguges.liberty]: true,
        [projecLanguges.spring]: true,
    }
};

// list of mocked exposed debug ports
export const randomDebugPort = "1000";

// default context roots for projects
export const defaultContextRoot: any = {
    [codewindTemplates.docker]: {
        [projecLanguges.lagom]: "/api/hello/you"
    }
};

// default health check endpoints for projects
export const defaultHealthCheckEndPoint = "/";

// project specific setting for projects that only expose one app port
export const oneExposedPortOnly: any = {
    [codewindTemplates.default]: {
        [projecLanguges.liberty]: {
            "local": false,
            "kube": false
        },
        [projecLanguges.nodejs]: {
            "local": false,
            "kube": true
        },
        [projecLanguges.spring]: {
            "local": false,
            "kube": true
        },
        [projecLanguges.swift]: {
            "local": true,
            "kube": true
        }
    },
    [codewindTemplates.docker]: {
        [projecLanguges.go]: {
            "local": true,
            "kube": true
        },
        [projecLanguges.lagom]: {
            "local": false,
            "kube": true
        },
        [projecLanguges.python]: {
            "local": true,
            "kube": true
        }
    }
};

// project specific setting for default app ports
export const defaultInternalPorts: any = {
    [codewindTemplates.default]: {
        [projecLanguges.liberty]: libertyProject.getDefaultAppPort(),
        [projecLanguges.nodejs]: nodeProject.getDefaultAppPort(),
        [projecLanguges.spring]: springProject.getDefaultAppPort(),
        [projecLanguges.swift]: swiftProject.getDefaultAppPort()
    },
    [codewindTemplates.docker]: {
        [projecLanguges.go]: "8000",
        [projecLanguges.lagom]: "9000",
        [projecLanguges.python]: "5000",
    }
};

// project specific setting for default app debug ports
export const defaultInternalDebugPorts: any = {
    [codewindTemplates.default]: {
        [projecLanguges.liberty]: libertyProject.getDefaultDebugPort(),
        [projecLanguges.nodejs]: nodeProject.getDefaultDebugPort(),
        [projecLanguges.spring]: springProject.getDefaultDebugPort(),
    }
};

// project specific settings to mark the main files
export const filesToUpdate: any = {
    [codewindTemplates.default]: {
        [projecLanguges.liberty]: ["Dockerfile", "src/main/java/application/rest/v1/Example.java"],
        [projecLanguges.nodejs]: ["Dockerfile", "server/server.js"],
        [projecLanguges.spring]: ["Dockerfile", "src/main/java/application/rest/v1/Example.java"],
        [projecLanguges.swift]: ["Dockerfile", "Sources/Application/Routes/HealthRoutes.swift"],
    },
    [codewindTemplates.docker]: {
        [projecLanguges.go]: ["Dockerfile", "main.go"],
        [projecLanguges.lagom]: ["Dockerfile",
            "hello-api/src/main/java/com/example/rp/test/lagomendpoints/api/HelloService.java",
            "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloModule.java",
            "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloServiceImpl.java"],
        [projecLanguges.python]: ["Dockerfile", "app.py"],
    },
    [codewindTemplates.odo]: {
        [projecLanguges.nodejs]: ["server.js"],
        [projecLanguges.perl]: ["index.pl"],
        [projecLanguges.python]: ["wsgi.py"]
    }
};
