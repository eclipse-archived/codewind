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
"use strict";
import { StartModes } from "./constants";
import { ProjectInfo, UpdateProjectInfoPair, InotifyArgs, ProjectSettingsEvent } from "./Project";
import * as logger from "../utils/logger";
import * as projectsController from "../controllers/projectsController";
import * as projectExtensions from "../extensions/projectExtensions";
import * as projectUtil from "./projectUtil";
import { Operation } from "./operation";
import * as io from "../utils/socket";
import * as processManager from "../utils/processManager";
const xss = require("xss"); // tslint:disable-line:no-require-imports

export const specificationSettingMap = new Map<string, (args: any, operation: Operation) => any>();


/**
 * @function
 * @description Reconfig the debug port for a project.
 *
 * @param debugPort <Required | string> - Required value for reconfiguration of debug port.
 * @param operation <Required | Operation> - Operation object for the project.
 *
 * @returns Promise<any>
 */
const changeInternalDebugPort = async function (debugPort: string, operation: Operation): Promise<any> {

    const projectInfo: ProjectInfo = operation.projectInfo;
    const projectID = projectInfo.projectID;
    const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
    const capabilities = projectExtensions.getProjectCapabilities(projectHandler);
    const settingName = "internalDebugPort";

    debugPort = debugPort.toString();
    if (process.env.IN_K8 === "true") {
        if (debugPort.trim().length != 0) {
            const errorMsg = "BAD_REQUEST: debug mode is not supported on ICP. ";
            logger.logProjectError("changeDebugPort API: Failed with message: " + errorMsg, projectID);
            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                name: settingName,
                ports: {
                    internalDebugPort: debugPort
                },
                status: "failed",
                error: errorMsg
            };
            io.emitOnListener("projectSettingsChanged", data);
        }
        return;
    }

    if ( !capabilities || ( !capabilities.hasStartMode("debug") && !capabilities.hasStartMode("debugNoInit") )) {
            const errorMsg = "BAD_REQUEST: The project does not support debug mode.";
            logger.logProjectError("changeDebugPort API: Failed with message: " + errorMsg, projectID);

            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                name: settingName,
                ports: {
                    internalDebugPort: debugPort
                },
                status: "failed",
                error: errorMsg
            };
            io.emitOnListener("projectSettingsChanged", data);
            return;
    }

    if (debugPort.trim().length == 0) {
        // Set the debug port to the default debug port if available else undefined
        if (projectHandler.getDefaultDebugPort()) {
            debugPort = projectHandler.getDefaultDebugPort();
        } else {
            debugPort = undefined;
        }
        logger.logProjectInfo("changeDebugPort API: Project debug port is empty, setting to the default debug port: " + debugPort, projectID);
    }

    if (projectInfo.debugPort !== debugPort) {
        const keyValuePair: UpdateProjectInfoPair = {
                key: "debugPort",
                value: debugPort,
                saveIntoJsonFile: true
        };
        operation.projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);
        if (projectInfo.startMode === StartModes.debug || projectInfo.startMode === StartModes.debugNoInit) {
            // call project restart to change the debug port
            projectUtil.restartProject(operation, projectInfo.startMode, "projectSettingsChanged");
        } else {
            // return success status since no restart required
            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                name: settingName,
                ports: {
                    internalDebugPort: debugPort
                },
                status: "success"
            };
            io.emitOnListener("projectSettingsChanged", data);
        }
    } else {
        logger.logProjectInfo("changeDebugPort API: Project debug port is already set to: " + debugPort, projectID);
    }

};

/**
 * @function
 * @description Reconfig the application port for a project.
 *
 * @param applicationPort <Required | string> - Required value for reconfiguration of application port.
 * @param operation <Required | Operation> - Operation object for the project.
 *
 * @returns Promise<any>
 */
const changeInternalPort = async function (applicationPort: string, operation: Operation): Promise<any> {

    let projectInfo: ProjectInfo = operation.projectInfo;
    const projectID = projectInfo.projectID;
    const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
    const settingName = "internalPort";

    applicationPort = applicationPort.toString();

    if (applicationPort.trim().length == 0) {
        // Set the application port to the default application port if available else use getContainerInfo
        if (projectHandler.getDefaultAppPort) {
            const port = projectHandler.getDefaultAppPort();
            if (Array.isArray(port)) {
                // only 1 default port we can use it
                if (port.length == 1)
                    applicationPort = port[0];
            }
            else if (port)
                applicationPort = port;
        }
        // still don't have a valid application port, check container info
        if (applicationPort.trim().length == 0) {
            // if the project handler does not have default app port, use the projectUtil.getContainerInfo logic
            const containerInfo: any = await projectUtil.getContainerInfo(projectInfo, true);
            applicationPort = containerInfo.internalPort;
        }
        logger.logProjectInfo("changeInternalAppPort API: Project application port is empty, setting to the default application port: " + applicationPort, projectID);
    }

    if (projectInfo.appPorts[0] == applicationPort) {
        logger.logProjectInfo("changeInternalAppPort API: Project application port is already set to: " + applicationPort, projectID);
        return;
    }

    try {
        let isApplicationPortExposed: boolean = false;

        // Check if the port requested has been exposed
        if (process.env.IN_K8) {
            const containerInfo: any = await projectUtil.getContainerInfo(projectInfo, true);
            for (let i = 0; i < containerInfo.podPorts.length; i++) {
                const port = containerInfo.podPorts[i];

                if (applicationPort == port) {
                    isApplicationPortExposed = true;
                    break;
                }
            }
        } else {
            const containerInfo: any = await projectUtil.getContainerInfo(projectInfo, true);
            for (let i = 0; i < containerInfo.containerPorts.length; i++) {
                const port = containerInfo.containerPorts[i];

                if (applicationPort == port) {
                    isApplicationPortExposed = true;
                    break;
                }
            }
        }

        if (!isApplicationPortExposed) {
            logger.logProjectInfo("changeInternalAppPort API: Application Port requested has not been exposed: " + applicationPort, projectInfo.projectID);
            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                name: settingName,
                ports: {
                    internalPort: applicationPort
                },
                status: "failed",
                error: "Application Port requested has not been exposed: " + applicationPort
            };

            io.emitOnListener("projectSettingsChanged", data);
            return { "status": "failed", "error": "Application Port requested has not been exposed" };
        }

        const keyValuePair: UpdateProjectInfoPair = {
            key: "appPorts",
            value: applicationPort,
            saveIntoJsonFile: true
        };
        projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);
        logger.logProjectInfo("changeInternalAppPort API: The projectInfo has been updated: " + JSON.stringify(projectInfo), projectInfo.projectID);

        // Set the containerInfoForceRefreshMap for the project to true, so that isApplicationUp/ping can pick up the new port with a force refresh
        projectUtil.containerInfoForceRefreshMap.set(projectID, true);

        logger.logProjectInfo("changeInternalAppPort API: The application port for the project has been set to " + applicationPort, projectInfo.projectID);

        // Get the container info with the new ports
        const containerInfo: any = await projectUtil.getContainerInfo(projectInfo, projectUtil.containerInfoForceRefreshMap.get(projectInfo.projectID));
        logger.logProjectInfo("changeInternalAppPort API: The containerInfo has been refreshed with the requested application port: " + JSON.stringify(containerInfo), projectInfo.projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            status: "success",
            ports: {
                exposedPort: containerInfo.exposedPort,
                internalPort: containerInfo.internalPort
            }
        };

        io.emitOnListener("projectSettingsChanged", data);
    } catch (err) {
        logger.logProjectError("changeInternalAppPort API: File-watcher encountered an error while changing the application port: " + err, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            ports: {
                internalPort: applicationPort
            },
            status: "failed",
            error: "File-watcher encountered an error while changing the application port: " + err
        };

        io.emitOnListener("projectSettingsChanged", data);
    }
};

/**
 * @function
 * @description Configure a project's context root.
 *
 * @param args <Required | Any> - Metadata args for a project.
 *
 * @param operationId <Required | Any> - Operation ID for a project.
 *
 * @returns Promise<{ operationId: string }>
 */
const changeContextRoot = async function(args: any, operation: Operation): Promise<any> {
    const projectInfo: ProjectInfo = operation.projectInfo;
    const projectID = projectInfo.projectID;
    const settingName = "contextRoot";

    // File watcher removes all leading and trailing forward slashes of the context root that portal passes to file watcher for filter context root purpose
    let contextRoot = args.replace(/^\/+/, "").replace(/\/+$/, "");

    // Sanitize context root to prevent XSS attack
    const sanitizedContextRoot = xss(contextRoot, {
        whiteList:          [],        // empty, means filter out all tags
        stripIgnoreTag:     true,      // filter out all tags not in the whilelist
        stripIgnoreTagBody: ["script"] // filter out content in the script tag
    });

    if (sanitizedContextRoot !== contextRoot) {
        const errorMsg: string = "BAD_REQUEST: The context root is not valid";

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            contextRoot: "/" + contextRoot,
            status: "failed",
            error: errorMsg
        };

        io.emitOnListener("projectSettingsChanged", data);

        return;
    }

    contextRoot = contextRoot.trim();

    if (!projectInfo.contextRoot && contextRoot.length == 0) {
        logger.logProjectInfo("changeContextRoot API: Project's contextRoot is already set to default", projectID);
        return;
    }

    if (projectInfo.contextRoot == "/" + contextRoot) {
        logger.logProjectInfo("changeContextRoot API: Project's contextRoot is already set to: " + contextRoot, projectID);
        return;
    }
    logger.logProjectInfo("changeContextRoot API: Project ID is " + projectID, projectID);
    logger.logProjectInfo("changeContextRoot API: : Update Project context root to " + contextRoot, projectID);

    const keyValuePair: UpdateProjectInfoPair = {
        key : "contextRoot",
        value: "/" + contextRoot,
        saveIntoJsonFile: true
    };

    try {
        projectsController.updateProjectInfo(projectID, keyValuePair);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            contextRoot: "/" + contextRoot,
            status: "success"
        };

        logger.logProjectInfo("changeContextRoot API: Change context root successfully", projectID);

        io.emitOnListener("projectSettingsChanged", data);
    } catch (err) {

        logger.logProjectError("changeContextRoot API: Failed with message: " + err.message, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            contextRoot: "/" + contextRoot,
            status: "failed",
            error: err.message
        };

        io.emitOnListener("projectSettingsChanged", data);
    }
};

/**
 * @function
 * @description Reconfig the watched files for a project.
 *
 * @param args <Required | Any> - Required arguments for reconfiguration of watched files.
 *
 * @returns Promise<any>
 */
const reconfigWatchedFiles = async function (args: any, operation: Operation): Promise<any> {
    const projectInfo: ProjectInfo = operation.projectInfo;
    const projectID = projectInfo.projectID;
    const settingName = "watchedFiles";

    if (!args.includeFiles && !args.excludeFiles) {
        const errorMsg = "BAD_REQUEST: Neither of includeFiles or excludeFiles path was provided.";
        logger.logProjectError("reconfigWatchedFiles API: Failed with message: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            status: "failed",
            error: errorMsg
        };

        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    if ((args.includeFiles && !(args.includeFiles instanceof Array)) || ( args.excludeFiles && !(args.excludeFiles instanceof Array))) {
        const errorMsg = "BAD_REQUEST: The includeFiles path and excludeFiles path are expecting to be passed in as a string array.";
        logger.logProjectError("reconfigWatchedFiles API: Failed with message: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    // Ignore the setting if excludeFiles has length greater than 1 and has an empty string because it may cause project-watcher to fail
    let excludeFilesFlag = true;
    if (args.excludeFiles && args.excludeFiles.length > 1) {
        for (let i = 0; i < args.excludeFiles.length; i++) {
            if (args.excludeFiles[i].trim().length == 0) {
                excludeFilesFlag = false;
                break;
            }
        }

        if (!excludeFilesFlag) {
            const errorMsg = "BAD_REQUEST: At least one of the element is empty, File-watcher will ignore the setting watchedFiles.excludeFiles";
            logger.logProjectError("reconfigWatchedFiles API: Failed with message: " + errorMsg, projectID);

            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                name: settingName,
                status: "failed",
                error: errorMsg
            };
            io.emitOnListener("projectSettingsChanged", data);
            return;
        }
    }

        // Ignore the setting if includeFiles has length greater than 1 and has an empty string because it may cause project-watcher to fail
        let includeFilesFlag = true;
        if (args.includeFiles && args.includeFiles.length > 1) {
            for (let i = 0; i < args.includeFiles.length; i++) {
                if (args.includeFiles[i].trim().length == 0) {
                    includeFilesFlag = false;
                    break;
                }
            }

            if (!includeFilesFlag) {
                const errorMsg = "BAD_REQUEST: At least one of the element is empty, File-watcher will ignore the setting watchedFiles.includeFiles";
                logger.logProjectError("reconfigWatchedFiles API: Failed with message: " + errorMsg, projectID);

                const data: ProjectSettingsEvent = {
                    operationId: operation.operationId,
                    projectID: projectID,
                    name: settingName,
                    status: "failed",
                    error: errorMsg
                };
                io.emitOnListener("projectSettingsChanged", data);
                return;
            }
        }

    args.excludeFiles = (args.excludeFiles && args.excludeFiles[0].trim().length > 0) ? args.excludeFiles : undefined;
    args.includeFiles = (args.includeFiles && args.includeFiles[0].trim().length > 0) ? args.includeFiles : undefined;

    if (projectInfo.watchedFiles == args.includeFiles && projectInfo.ignoredFiles == args.excludeFiles ) {
        logger.logProjectInfo("reconfigWatchedFiles API: Project watchedFiles is already set to: " + ((args.includeFiles) ? args.includeFiles.toString() : "default" ), projectID);
        logger.logProjectInfo("reconfigWatchedFiles API: Project ignoredFiles is already set to: " + ((args.excludeFiles) ? args.excludeFiles.toString() : "default"), projectID);
        return;
    }

    const workspaceOrigin = process.argv[2];

    if (!process.env.IN_K8) {
        const keyValuePair: UpdateProjectInfoPair = {
            key: "watchedFiles",
            value: args.includeFiles,
            saveIntoJsonFile: true
        };
        await projectsController.updateProjectInfo(projectID, keyValuePair);

        keyValuePair.key = "ignoredFiles";
        keyValuePair.value = args.excludeFiles;
        await projectsController.updateProjectInfo(projectID, keyValuePair);
        await processManager.killInotifyProcess(projectID);
        processManager.spawnDetached(projectID, "/file-watcher/scripts/project-watcher.sh", [projectInfo.location, workspaceOrigin, projectID, "localhost", (args.includeFiles && args.includeFiles[0].trim().length > 0) ? args.includeFiles.toString() : undefined, (args.excludeFiles && args.excludeFiles[0].trim().length > 0) ? args.excludeFiles.toString() : undefined, operation.operationId, (process.env.PORTAL_HTTPS == "true") ? "9191" : "9090", "&"], { cwd: projectInfo.location }, (result) => {});

    }
};

/**
 * @function
 * @description Reconfig the ignored files for a project.
 *
 * @param args <Required | Any> - Required arguments for reconfiguration of ignroed files.
 *
 * @returns Promise<any>
 */
const reconfigIgnoredFilesForDaemon = async function (ignoredPaths: string[], operation: Operation): Promise<any> {
    // ignoredFilesForDeamon is the project settings for filewatcher daemon
    // will rename the settings name once we removed project-watcher
    const projectInfo: ProjectInfo = operation.projectInfo;
    const projectID = projectInfo.projectID;
    const settingName = "ignoredPaths";
    if (!ignoredPaths) {
        const errorMsg = "BAD_REQUEST: ignoredPaths is required, but was not provided.";
        logger.logProjectError("reconfigIgnoredFilesForDaemon API: Failed with message: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            status: "failed",
            error: errorMsg
        };

        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    // Ignore empty strings in ignoredPaths
    ignoredPaths = ignoredPaths.filter( el => {
        return el.trim().length > 0 ;
    });
    logger.logProjectInfo("ignoredPaths after removed any empty strings: " + ignoredPaths, projectID);

    if (ignoredPaths == undefined || ignoredPaths.length == 0) {
        const errorMsg = "BAD_REQUEST: The ignoredPaths array is empty, File-watcher will ignore the setting";
        logger.logProjectError("reconfigWatchedFiles API: Failed with message: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    if (projectInfo.ignoredPaths.length == ignoredPaths.length
        && projectInfo.ignoredPaths.every((element, index) => {
            return element === ignoredPaths[index];
        })
    ) {
        logger.logProjectInfo("reconfigWatchedFiles API: Project ignoredPaths is already set to: " + ((ignoredPaths) ? ignoredPaths.toString() : "default" ), projectID);
        return;
    }

    const keyValuePair: UpdateProjectInfoPair = {
        key: "ignoredPaths",
        value: ignoredPaths,
        saveIntoJsonFile: true
    };
    await projectsController.updateProjectInfo(projectID, keyValuePair);

    const data: ProjectSettingsEvent = {
        operationId: operation.operationId,
        projectID: projectID,
        name: settingName,
        status: "success"
    };
    if (ignoredPaths) {
        data.ignoredPaths = ignoredPaths;
    }

    logger.logProjectInfo("reconfigIgnoredFilesForDaemon API: Change ignored files successfully", projectID);
    io.emitOnListener("projectSettingsChanged", data);
};


 /**
  * @function
  * @description Configure a project's health check.
  *
  * @param args <Required | Any> - Metadata args for a project.
  *
  * @param operationId <Required | Any> - Operation ID for a project.
  *
  * @returns Promise<{ operationId: string }>
  */
 const changeHealthCheck = async function(args: any, operation: Operation): Promise<any> {
    const projectID = operation.projectInfo.projectID;
    const projectInfo: ProjectInfo = operation.projectInfo;
    const settingName = "healthCheck";

    // File watcher removes all leading and trailing forward slashes of the health check that portal passes to file watcher for filter health check purpose
    let healthCheck = args.replace(/^\/+/, "").replace(/\/+$/, "");

    // Sanitize context root to prevent XSS attack
    const sanitizedHealthCheck = xss(healthCheck, {
        whiteList:          [],        // empty, means filter out all tags
        stripIgnoreTag:     true,      // filter out all tags not in the whilelist
        stripIgnoreTagBody: ["script"] // filter out content in the script tag
    });

    if (sanitizedHealthCheck !== healthCheck) {
        const errorMsg: string = "BAD_REQUEST: The health check is not valid";
        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            healthCheck: "/" + healthCheck,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    healthCheck = healthCheck.trim();

    if (!projectInfo.healthCheck && healthCheck.length == 0) {
        logger.logProjectInfo("changeHealthCheck API: Project's healthCheck is already set to default", projectID);
        return;
    }

    if (projectInfo.healthCheck == "/" + healthCheck) {
        logger.logProjectInfo("changeHealthCheck API: Project's healthCheck is already set to: " + healthCheck, projectID);
        return;
    }

    logger.logProjectInfo("changeHealthCheck API: Project ID is " + projectID, projectID);
    logger.logProjectInfo("changeHealthCheck API: Update Project health check to " + healthCheck, projectID);

    const keyValuePair: UpdateProjectInfoPair = {
        key : "healthCheck",
        value: "/" + healthCheck,
        saveIntoJsonFile: true
    };

    try {
        projectsController.updateProjectInfo(projectID, keyValuePair);
        const data = {
            operationId: operation.operationId,
            projectID: projectID,
            name: "healthCheck",
            healthCheck: "/" + healthCheck,
            status: "success"
        };
        logger.logProjectInfo("changeHealthCheck API: Change health check successfully", projectID);
        io.emitOnListener("projectSettingsChanged", data);
    } catch (err) {
        logger.logProjectError("changeHealthCheck API: Failed with message: " + err.message, projectID);
        const data = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            healthCheck: "/" + healthCheck,
            status: "failed",
            error: err.message
        };
        io.emitOnListener("projectSettingsChanged", data);
    }
};

/**
 * @function
 * @description Reconfig the maven profiles for a Maven project.
 *
 * @param mavenProfiles <Required | string> - Required value for reconfiguration of Maven project.
 * @param operation <Required | Operation> - Operation object for the project.
 *
 * @returns Promise<any>
 */
const changeMavenProfiles = async function (mavenProfiles: any, operation: Operation): Promise<any> {

    let projectInfo: ProjectInfo = operation.projectInfo;
    const projectID = projectInfo.projectID;
    const projectType = projectInfo.projectType;
    const settingName = "mavenProfiles";

    if (!mavenProfiles) {
        const errorMsg = "BAD_REQUEST: The mavenProfiles was not passed";
        logger.logProjectError("changeMavenProfiles API: Failed with message: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    if (mavenProfiles && !(mavenProfiles instanceof Array)) {
        const errorMsg = "BAD_REQUEST: The mavenProfiles is expected to be passed in as a string array.";
        logger.logProjectError("changeMavenProfiles API: Failed with message: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    if (mavenProfiles && (mavenProfiles instanceof Array)) {
        if (mavenProfiles.length == 1 && mavenProfiles[0].trim().length == 0) {
             // Ignore if settings value is empty like "" or " "
            logger.logProjectInfo("changeMavenProfiles API: Value empty, File-watcher will ignore the setting mavenProfiles", projectID);
            const keyValuePair: UpdateProjectInfoPair = {
                key : "mavenProfiles",
                value: undefined,
                saveIntoJsonFile: true
            };
            await projectsController.updateProjectInfo(projectID, keyValuePair);
            return;
        }
    }

    if (projectType == "liberty" || projectType == "spring") {
        if (projectInfo.mavenProfiles && (mavenProfiles.toString() == projectInfo.mavenProfiles.toString())) {
            logger.logProjectInfo("changeMavenProfiles API: Project mavenProfiles is already set to: " + mavenProfiles, projectID);
            return;
        }
        const keyValuePair: UpdateProjectInfoPair = {
            key: "mavenProfiles",
            value: mavenProfiles,
            saveIntoJsonFile: true
        };
        projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);
        logger.logProjectInfo("changeMavenProfiles API: The projectInfo has been updated: " + JSON.stringify(projectInfo), projectInfo.projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            status: "success"
        };
        io.emitOnListener("projectSettingsChanged", data);
    } else {
        logger.logProjectInfo("changeMavenProfiles API: Maven settings cannot be set for a non-Maven project of type: " + projectType, projectInfo.projectID);
            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                name: settingName,
                status: "failed",
                error: "Maven settings cannot be set for a non-Maven project of type: " + projectType
            };
            io.emitOnListener("projectSettingsChanged", data);
            return;
    }

    return;
};

/**
 * @function
 * @description Reconfig the maven properties for a Maven project.
 *
 * @param mavenProperties <Required | string> - Required value for reconfiguration of Maven project.
 * @param operation <Required | Operation> - Operation object for the project.
 *
 * @returns Promise<any>
 */
const changeMavenProperties = async function (mavenProperties: any, operation: Operation): Promise<any> {

    let projectInfo: ProjectInfo = operation.projectInfo;
    const projectID = projectInfo.projectID;
    const projectType = projectInfo.projectType;
    const settingName = "mavenProperties";

    if (!mavenProperties) {
        const errorMsg = "BAD_REQUEST: The mavenProperties was not passed";
        logger.logProjectError("changeMavenProperties API: Failed with message: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    if (mavenProperties && !(mavenProperties instanceof Array)) {
        const errorMsg = "BAD_REQUEST: The mavenProperties is expected to be passed in as a string array.";
        logger.logProjectError("changeMavenProperties API: Failed with message: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    if (mavenProperties && (mavenProperties instanceof Array)) {
        if (mavenProperties.length == 1 && mavenProperties[0].trim().length == 0) {
             // Ignore if settings value is empty like "" or " "
            logger.logProjectInfo("changeMavenProperties API: Value empty, File-watcher will ignore the setting mavenProperties", projectID);
            const keyValuePair: UpdateProjectInfoPair = {
                key : "mavenProperties",
                value: undefined,
                saveIntoJsonFile: true
            };
            await projectsController.updateProjectInfo(projectID, keyValuePair);
            return;
        }
    }

    if (projectType == "liberty" || projectType == "spring") {
        if (projectInfo.mavenProperties && (mavenProperties.toString() == projectInfo.mavenProperties.toString())) {
            logger.logProjectInfo("changeMavenProperties API: Project mavenProperties is already set to: " + mavenProperties, projectID);
            return;
        }
        const keyValuePair: UpdateProjectInfoPair = {
            key: "mavenProperties",
            value: mavenProperties,
            saveIntoJsonFile: true
        };
        projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);
        logger.logProjectInfo("changeMavenProperties API: The projectInfo has been updated: " + JSON.stringify(projectInfo), projectInfo.projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            name: settingName,
            status: "success"
        };
        io.emitOnListener("projectSettingsChanged", data);
    } else {
        logger.logProjectInfo("changeMavenProperties API: Maven settings cannot be set for a non-Maven project of type: " + projectType, projectInfo.projectID);
            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                name: settingName,
                status: "failed",
                error: "Maven settings cannot be set for a non-Maven project of type: " + projectType
            };
            io.emitOnListener("projectSettingsChanged", data);
            return;
    }

    return;
};

/**
 * @function
 * @description Project specification handler.
 *
 * @param projectID <Required | string> - Project ID of the project that user wants to configure.
 *
 * @param settings <Required | any> - Specific settings of the project that user wants to configure.
 *
 * @returns Promise<{ operationId: string }>
 */
export async function projectSpecificationHandler(projectID: string, settings: any): Promise<{ operationId: string }> {
    logger.logProjectInfo("Project settings API: Project ID is " + projectID, projectID);
    logger.logProjectInfo("Project settings API: Project settings are " + JSON.stringify(settings), projectID);

    const projectInfo: ProjectInfo = await projectUtil.getProjectInfo(projectID);

    if (!projectInfo) {
        const error = new Error("No project found for project id: " + projectID);
        error.name = "FILE_NOT_EXIST";
        throw error;
    }

    // Create operation
    const operation = new Operation("", projectInfo);

    for (const key in settings) {
        if (!specificationSettingMap.has(key)) {
            const errorMsg = "BAD_REQUEST: Each setting must have a name and a value. Or the specified setting is not reconfigurable.";
            logger.logProjectError(errorMsg, projectID);

            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                name: key,
                status: "failed",
                error: errorMsg
            };
            io.emitOnListener("projectSettingsChanged", data);
        } else {
            if (settings[key] == undefined) {
                const errorMsg = "BAD_REQUEST: Each setting must have a name and a value. Or the specified setting is not reconfigurable.";
                logger.logProjectError(errorMsg, projectID);
                const data: ProjectSettingsEvent = {
                    operationId: operation.operationId,
                    projectID: projectID,
                    name: key,
                    status: "failed",
                    error: errorMsg
                };
                io.emitOnListener("projectSettingsChanged", data);
                continue;
            }
            await specificationSettingMap.get(key)(settings[key], operation);
        }
    }

    logger.logProjectInfo("Project settings API: Return operation ID: " + operation.operationId, projectID);
    return { "operationId": operation.operationId };
}


specificationSettingMap.set("internalDebugPort", changeInternalDebugPort);
specificationSettingMap.set("internalPort", changeInternalPort);
specificationSettingMap.set("contextRoot", changeContextRoot);
specificationSettingMap.set("watchedFiles", reconfigWatchedFiles);
specificationSettingMap.set("healthCheck", changeHealthCheck);
specificationSettingMap.set("mavenProfiles", changeMavenProfiles);
specificationSettingMap.set("mavenProperties", changeMavenProperties);
specificationSettingMap.set("ignoredPaths", reconfigIgnoredFilesForDaemon);
