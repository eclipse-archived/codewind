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

import { codewindTemplates, projectLanguges } from "./app.config";

/**
 * Please note: This is the project config file. The configs are set in the order of template -> projectLang in an object. If a key is missing by default it means that specific functionality for that key is not supported.
 */

// This config is to manual reset the running build queue and build status options for all project types.
// We currently need to do that because project that relies on script and IDC code does not follow the typescript code and need to be manually reset.
export const needManualReset: any = {
    [codewindTemplates.default]: {
        [projectLanguges.liberty]: {
            "appStatus": true,
            "buildStatus": true
        },
        [projectLanguges.nodejs]: {
            "appStatus": true,
            "buildStatus": true
        },
        [projectLanguges.spring]: {
            "appStatus": true,
            "buildStatus": true,
        },
        [projectLanguges.swift]: {
            "appStatus": false,
            "buildStatus": true
        }
    },
    [codewindTemplates.odo]: {
        [projectLanguges.nodejs]: {
            "appStatus": false,
            "buildStatus": true
        },
        [projectLanguges.perl]: {
            "appStatus": false,
            "buildStatus": true
        },
        [projectLanguges.python]: {
            "appStatus": false,
            "buildStatus": true
        }
    }
};

// project specific capability settings: start modes and control commands
export const projectCapabilities: any = {
    [codewindTemplates.default]: {
        [projectLanguges.liberty]: {
            "local": {
                "startModes": ["run", "debug"],
                "controlCommands": ["restart"]
            },
            "kube": project.defaultProjectCapabilities
        },
        [projectLanguges.nodejs]: {
            "local": {
                "startModes": ["run", "debugNoInit"],
                "controlCommands": ["restart"]
            },
            "kube": project.defaultProjectCapabilities
        },
        [projectLanguges.spring]: {
            "local": {
                "startModes": ["run", "debug", "debugNoInit"],
                "controlCommands": ["restart"]
            },
            "kube": project.defaultProjectCapabilities
        },
        [projectLanguges.swift]: {
            "local": project.defaultProjectCapabilities,
            "kube": project.defaultProjectCapabilities
        }
    },
    [codewindTemplates.docker]: {
        [projectLanguges.go]: {
            "local": project.defaultProjectCapabilities,
            "kube": project.defaultProjectCapabilities
        },
        [projectLanguges.lagom]: {
            "local": project.defaultProjectCapabilities,
            "kube": project.defaultProjectCapabilities
        },
        [projectLanguges.python]: {
            "local": project.defaultProjectCapabilities,
            "kube": project.defaultProjectCapabilities
        }
    },
    [codewindTemplates.odo]: {
        [projectLanguges.nodejs]: {
            "kube": project.defaultProjectCapabilities
        },
        [projectLanguges.perl]: {
            "kube": project.defaultProjectCapabilities
        },
        [projectLanguges.python]: {
            "kube": project.defaultProjectCapabilities
        }
    }
};

// auto build enable/disable event capabilities: some projects emit the project changed event and some don't do anything
export const autoBuildEventCapabailities: any = {
    [codewindTemplates.default]: {
        [projectLanguges.nodejs]: true,
    }
};

// list of start modes available in Turbine
export const startModes: Array<string> = ["run", "debug", "debugNoInit"];

// project specific restart capabilities depending on the above start modes
export const restartCapabilities: any = {
    [codewindTemplates.default]: {
        [projectLanguges.liberty]: [startModes[0], startModes[1]],
        [projectLanguges.nodejs]: [startModes[0], startModes[2]],
        [projectLanguges.spring]: startModes,
    }
};

// project specific debug capabilities
export const debugCapabilities: any = {
    [codewindTemplates.default]: {
        [projectLanguges.liberty]: true,
        [projectLanguges.nodejs]: true,
        [projectLanguges.spring]: true,
    }
};

// project specific maven profile capabilities
export const mavenProfileCapabilities: any = {
    [codewindTemplates.default]: {
        [projectLanguges.liberty]: true,
        [projectLanguges.spring]: true,
    }
};

// list of mocked exposed debug ports
export const randomDebugPort = "1000";

// default context roots for projects
export const defaultContextRoot: any = {
    [codewindTemplates.docker]: {
        [projectLanguges.lagom]: "/api/hello/you"
    }
};

// default health check endpoints for projects
export const defaultHealthCheckEndPoint = "/";

// project specific setting for projects that only expose one app port
export const oneExposedPortOnly: any = {
    [codewindTemplates.default]: {
        [projectLanguges.liberty]: {
            "local": false,
            "kube": false
        },
        [projectLanguges.nodejs]: {
            "local": false,
            "kube": true
        },
        [projectLanguges.spring]: {
            "local": false,
            "kube": true
        },
        [projectLanguges.swift]: {
            "local": true,
            "kube": true
        }
    },
    [codewindTemplates.docker]: {
        [projectLanguges.go]: {
            "local": true,
            "kube": true
        },
        [projectLanguges.lagom]: {
            "local": false,
            "kube": true
        },
        [projectLanguges.python]: {
            "local": true,
            "kube": true
        }
    }
};

// project specific setting for default app ports
export const defaultInternalPorts: any = {
    [codewindTemplates.default]: {
        [projectLanguges.liberty]: libertyProject.getDefaultAppPort(),
        [projectLanguges.nodejs]: nodeProject.getDefaultAppPort(),
        [projectLanguges.spring]: springProject.getDefaultAppPort(),
        [projectLanguges.swift]: swiftProject.getDefaultAppPort()
    },
    [codewindTemplates.docker]: {
        [projectLanguges.go]: "8000",
        [projectLanguges.lagom]: "9000",
        [projectLanguges.python]: "5000",
    }
};

// project specific setting for default app debug ports
export const defaultInternalDebugPorts: any = {
    [codewindTemplates.default]: {
        [projectLanguges.liberty]: libertyProject.getDefaultDebugPort(),
        [projectLanguges.nodejs]: nodeProject.getDefaultDebugPort(),
        [projectLanguges.spring]: springProject.getDefaultDebugPort(),
    }
};

// project specific settings to mark the main files
export const filesToUpdate: any = {
    [codewindTemplates.default]: {
        [projectLanguges.liberty]: ["Dockerfile", "src/main/java/application/rest/v1/Example.java"],
        [projectLanguges.nodejs]: ["Dockerfile", "server/server.js"],
        [projectLanguges.spring]: ["Dockerfile", "src/main/java/application/rest/v1/Example.java"],
        [projectLanguges.swift]: ["Dockerfile", "Sources/Application/Routes/HealthRoutes.swift"],
    },
    [codewindTemplates.docker]: {
        [projectLanguges.go]: ["Dockerfile", "main.go"],
        [projectLanguges.lagom]: ["Dockerfile",
            "hello-api/src/main/java/com/example/rp/test/lagomendpoints/api/HelloService.java",
            "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloModule.java",
            "hello-impl/src/main/java/com/example/rp/test/lagomendpoints/impl/HelloServiceImpl.java"],
        [projectLanguges.python]: ["Dockerfile", "app.py"],
    },
    [codewindTemplates.odo]: {
        [projectLanguges.nodejs]: ["server.js"],
        [projectLanguges.perl]: ["index.pl"],
        [projectLanguges.python]: ["wsgi.py"]
    }
};
