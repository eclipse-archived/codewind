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
import { ProjectInfo, UpdateProjectInfoPair, ProjectSettingsEvent } from "./Project";
import * as logger from "../utils/logger";
import * as projectsController from "../controllers/projectsController";
import * as projectStatusController from "../controllers/projectStatusController";
import * as projectExtensions from "../extensions/projectExtensions";
import * as projectUtil from "./projectUtil";
import { Operation } from "./operation";
import * as io from "../utils/socket";
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

    debugPort = debugPort.toString();
    if (process.env.IN_K8 === "true") {
        if (debugPort.trim().length != 0) {
            const errorMsg = "BAD_REQUEST: debug mode is not supported on Kubernetes. ";
            logger.logProjectError("Changing the debug port failed: " + errorMsg, projectID);
            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
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
            logger.logProjectError("Changing the debug port failed: " + errorMsg, projectID);

            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
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
        logger.logProjectInfo("The debug port is empty, setting to the default debug port: " + debugPort, projectID);
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
            // Get the container info with the new ports
            const containerInfo: any = await projectUtil.getContainerInfo(operation.projectInfo, true);
            logger.logProjectInfo("changeDebugPort API: The containerInfo: " + JSON.stringify(containerInfo), projectInfo.projectID);

            // return success status since no restart required
            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                ports: {
                    internalDebugPort: debugPort
                },
                status: "success"
            };

            if (containerInfo.internalPort && containerInfo.exposedPort) {
                data.ports.exposedPort = containerInfo.exposedPort;
                data.ports.internalPort = containerInfo.internalPort;
            }

            io.emitOnListener("projectSettingsChanged", data);
        }
    } else {
        logger.logProjectInfo("The debug port is already set to: " + debugPort, projectID);
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
        logger.logProjectInfo("The application port is empty, setting to the default application port: " + applicationPort, projectID);
    }

    if (projectInfo.appPorts[0] == applicationPort) {
        logger.logProjectInfo("The application port is already set to: " + applicationPort, projectID);
        return;
    }

    try {
        let isContainerRunning: boolean = true;
        let isApplicationPortExposed: boolean = false;

        // Check if the port requested has been exposed
        if (process.env.IN_K8) {
            const containerInfo: any = await projectUtil.getContainerInfo(projectInfo, true);
            isContainerRunning = containerInfo.podName.trim().length > 0;
            for (let i = 0; i < containerInfo.podPorts.length; i++) {
                const port = containerInfo.podPorts[i];

                if (applicationPort == port) {
                    isApplicationPortExposed = true;
                    break;
                }
            }
        } else {
            const containerInfo: any = await projectUtil.getContainerInfo(projectInfo, true);
            isContainerRunning = containerInfo.containerId.trim().length > 0;
            for (let i = 0; i < containerInfo.containerPorts.length; i++) {
                const port = containerInfo.containerPorts[i];

                if (applicationPort == port) {
                    isApplicationPortExposed = true;
                    break;
                }
            }
        }

        if (isContainerRunning && !isApplicationPortExposed) {
            logger.logProjectInfo("The requested application port is not exposed: " + applicationPort, projectInfo.projectID);
            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                ports: {
                    internalPort: applicationPort
                },
                status: "failed",
                error: "The requested application port is not exposed: " + applicationPort
            };

            io.emitOnListener("projectSettingsChanged", data);
            return { "status": "failed", "error": "The requested application port is not exposed" };
        }

        const keyValuePair: UpdateProjectInfoPair = {
            key: "appPorts",
            value: applicationPort,
            saveIntoJsonFile: true
        };
        projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);
        logger.logProjectInfo("The project has been updated", projectInfo.projectID);
        logger.logProjectTrace(JSON.stringify(projectInfo), projectInfo.projectID);

        // Delete the project from the array to show the next ping message
        if (projectUtil.firstTimePingArray.indexOf(projectID) > -1) {
            projectUtil.firstTimePingArray.splice(projectUtil.firstTimePingArray.indexOf(projectID), 1);
        }
        projectStatusController.pingCountMap.delete(projectID);

        // Set the containerInfoForceRefreshMap for the project to true, so that isApplicationUp/ping can pick up the new port with a force refresh
        projectUtil.containerInfoForceRefreshMap.set(projectID, true);

        logger.logProjectInfo("The application port for the project has been set to " + applicationPort, projectInfo.projectID);

        // Get the container info with the new ports
        const containerInfo: any = await projectUtil.getContainerInfo(projectInfo, projectUtil.containerInfoForceRefreshMap.get(projectInfo.projectID));
        logger.logProjectInfo("The project information has been refreshed.", projectInfo.projectID);
        logger.logProjectTrace("Container information:", projectInfo.projectID);
        logger.logProjectTrace(JSON.stringify(containerInfo), projectInfo.projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            status: "success",
            ports: {
                exposedPort: containerInfo.exposedPort,
                internalPort: applicationPort
            }
        };

        // Get the debug port only for local case
        if (!process.env.IN_K8) {
            // if debug port is not present in container info on start mode, then get it from project info
            if (containerInfo.internalDebugPort) {
                data.ports.internalDebugPort = containerInfo.internalDebugPort;
            } else if (projectInfo.debugPort) {
                data.ports.internalDebugPort = projectInfo.debugPort;
            }
        }

        io.emitOnListener("projectSettingsChanged", data);
    } catch (err) {
        logger.logProjectError("An error occurred while changing the application port: " + err, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            ports: {
                internalPort: applicationPort
            },
            status: "failed",
            error: "An error occurred while changing the application port: " + err
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
            contextRoot: "/" + contextRoot,
            status: "failed",
            error: errorMsg
        };

        io.emitOnListener("projectSettingsChanged", data);

        return;
    }

    contextRoot = contextRoot.trim();

    if (!projectInfo.contextRoot && contextRoot.length == 0) {
        logger.logProjectInfo("The context root is not set.", projectID);
        return;
    }

    if (projectInfo.contextRoot == "/" + contextRoot) {
        logger.logProjectInfo("The context root is set to: " + contextRoot, projectID);
        return;
    }
    logger.logProjectTrace("The Project ID is " + projectID, projectID);
    logger.logProjectInfo("Update the context root to " + contextRoot, projectID);

    const keyValuePair: UpdateProjectInfoPair = {
        key : "contextRoot",
        value: "/" + contextRoot,
        saveIntoJsonFile: true
    };

    try {
        await projectsController.updateProjectInfo(projectID, keyValuePair);

        // Delete the project from the array to show the next ping message
        if (projectUtil.firstTimePingArray.indexOf(projectID) > -1) {
            projectUtil.firstTimePingArray.splice(projectUtil.firstTimePingArray.indexOf(projectID), 1);
        }
        projectStatusController.pingCountMap.delete(projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            contextRoot: "/" + contextRoot,
            status: "success"
        };
        logger.logProjectInfo("The context root was updated successfully.", projectID);

        io.emitOnListener("projectSettingsChanged", data);
    } catch (err) {

        logger.logProjectError("Failed to change the context root: " + err.message, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            contextRoot: "/" + contextRoot,
            status: "failed",
            error: err.message
        };

        io.emitOnListener("projectSettingsChanged", data);
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
    const projectInfo: ProjectInfo = operation.projectInfo;
    const projectID = projectInfo.projectID;
    if (!ignoredPaths) {
        const errorMsg = "BAD_REQUEST: ignoredPaths is required, but was not provided.";
        logger.logProjectError("Failed to update ignored path list for file watching: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            ignoredPaths: undefined,
            status: "failed",
            error: errorMsg
        };

        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    if (!(ignoredPaths instanceof Array)) {
        const errorMsg = "BAD_REQUEST: ignoredPaths must be a string array.";
        logger.logProjectError("Failed to update ignored path list for file watching: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            ignoredPaths: undefined,
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
    logger.logProjectInfo("Attempting to set the ignored path list for file watching with: " + ignoredPaths, projectID);

    if (ignoredPaths.length == 0) {
        const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
        const Msg = "The ignored path list for file watching is empty, the default list will be used instead: " + JSON.stringify(projectHandler.defaultIgnoredPath);
        logger.logProjectInfo(Msg, projectID);
        ignoredPaths = projectHandler.defaultIgnoredPath;
    }

    if (projectInfo.ignoredPaths && projectInfo.ignoredPaths.length == ignoredPaths.length
        && projectInfo.ignoredPaths.every((element, index) => {
            return element === ignoredPaths[index];
        })
    ) {
        logger.logProjectInfo("The ignored path list for file watching is unchanged: " + ((ignoredPaths) ? ignoredPaths.toString() : "default" ), projectID);
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
        status: "success"
    };
    if (ignoredPaths) {
        data.ignoredPaths = ignoredPaths;
    }

    logger.logProjectInfo("The ignored path list for file watching was updated successfully.", projectID);
    io.emitOnListener("projectSettingsChanged", data);
};

/**
 * @function
 * @description Reconfig the WWW protocol for a project.
 *
 * @param isHttps <Required | Boolean> - isHttps tells if a project is https enabled.
 *
 * @param operation <Required | Any> - Operation for a project.
 *
 * @returns Promise<any>
 */
const reconfigWWWProtocol = async function (isHttps: boolean, operation: Operation): Promise<any> {
    let projectInfo: ProjectInfo = operation.projectInfo;
    const projectID = projectInfo.projectID;

    if (typeof isHttps != "boolean") {
        logger.logProjectError("Failed to update isHttps setting. The isHttps setting is not a boolean", projectID);
        return;
    }

    const isHttpsPreviously: boolean = projectInfo.isHttps;

    if (isHttps == isHttpsPreviously) {
        logger.logProjectInfo("The project WWW protocol is already set to: " + isHttps ? "https" : "http", projectID);
        return;
    }

    const keyValuePair: UpdateProjectInfoPair = {
        key: "isHttps",
        value: isHttps,
        saveIntoJsonFile: true
    };
    projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);

    logger.logProjectInfo("The project has been updated", projectInfo.projectID);
    logger.logProjectTrace(JSON.stringify(projectInfo), projectInfo.projectID);

    const data: ProjectSettingsEvent = {
        operationId: operation.operationId,
        projectID: projectID,
        status: "success",
        isHttps: isHttps
    };

    io.emitOnListener("projectSettingsChanged", data);

    logger.logProjectInfo("The WWW protocol for the project has been changed to: " + isHttps ? "https" : "http", projectID);
    return;
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
            healthCheck: "/" + healthCheck,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    healthCheck = healthCheck.trim();

    if (!projectInfo.healthCheck && healthCheck.length == 0) {
        logger.logProjectInfo("The health check endpoint is not set.", projectID);
        return;
    }

    if (projectInfo.healthCheck == "/" + healthCheck) {
        logger.logProjectInfo("The health check endpoint remains unchanged: " + healthCheck, projectID);
        return;
    }

    logger.logProjectTrace("changeHealthCheck API: Project ID is " + projectID, projectInfo.projectID);
    logger.logProjectInfo("The health check endpoint is set to: " + healthCheck, projectID);

    const keyValuePair: UpdateProjectInfoPair = {
        key : "healthCheck",
        value: "/" + healthCheck,
        saveIntoJsonFile: true
    };

    try {
        await projectsController.updateProjectInfo(projectID, keyValuePair);

        // Delete the project from the array to show the next ping message
        if (projectUtil.firstTimePingArray.indexOf(projectID) > -1) {
            projectUtil.firstTimePingArray.splice(projectUtil.firstTimePingArray.indexOf(projectID), 1);
        }
        projectStatusController.pingCountMap.delete(projectID);

        const data = {
            operationId: operation.operationId,
            projectID: projectID,
            name: "healthCheck",
            healthCheck: "/" + healthCheck,
            status: "success"
        };
        logger.logProjectInfo("The health check endpoint was updated successfully", projectID);
        io.emitOnListener("projectSettingsChanged", data);
    } catch (err) {
        logger.logProjectError("Failed to update the health check endpoint: " + err.message, projectID);
        const data = {
            operationId: operation.operationId,
            projectID: projectID,
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

    if (!mavenProfiles) {
        const errorMsg = "BAD_REQUEST: mavenProfiles is a required parameter.";
        logger.logProjectError("Failed to change the maven profile list: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            mavenProfiles: undefined,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    let arrayIsNotString = false;
    if (mavenProfiles instanceof Array) {
        for (const profile of mavenProfiles) {
            if (typeof profile !== "string") {
                arrayIsNotString = true;
                break;
            }
        }
    }

    if (mavenProfiles && arrayIsNotString) {
        const errorMsg = "BAD_REQUEST: mavenProfiles must be a string array.";
        logger.logProjectError("Failed to change the maven profile list: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            mavenProfiles: undefined,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    if (mavenProfiles && (mavenProfiles instanceof Array)) {
        if (mavenProfiles.length == 1 && mavenProfiles[0].trim().length == 0) {
             // Ignore if settings value is empty like "" or " "
            logger.logProjectInfo("The maven profile list is empty.", projectID);
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
            logger.logProjectInfo("The maven profile list remains unchanged: " + mavenProfiles, projectID);
            return;
        }
        const keyValuePair: UpdateProjectInfoPair = {
            key: "mavenProfiles",
            value: mavenProfiles,
            saveIntoJsonFile: true
        };
        projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);
        logger.logProjectTrace("changeMavenProfiles API: The projectInfo has been updated: " + JSON.stringify(projectInfo), projectInfo.projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            mavenProfiles: mavenProfiles,
            status: "success"
        };
        io.emitOnListener("projectSettingsChanged", data);
    } else {
        logger.logProjectInfo("Maven settings cannot be set for a non-Maven project: " + projectType, projectInfo.projectID);
            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                mavenProfiles: mavenProfiles,
                status: "failed",
                error: "Maven settings cannot be set for a non-Maven project: " + projectType
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

    if (!mavenProperties) {
        const errorMsg = "BAD_REQUEST: mavenProperties is a required parameter";
        logger.logProjectError("Failed to change the maven properties: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            mavenProperties: undefined,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    let arrayIsNotString = false;
    if (mavenProperties instanceof Array) {
        for (const property of mavenProperties) {
            if (typeof property !== "string") {
                arrayIsNotString = true;
                break;
            }
        }
    }

    if (mavenProperties && arrayIsNotString) {
        const errorMsg = "BAD_REQUEST: mavenProperties must be a string array.";
        logger.logProjectError("Failed to change the maven properties: " + errorMsg, projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            mavenProperties: undefined,
            status: "failed",
            error: errorMsg
        };
        io.emitOnListener("projectSettingsChanged", data);
        return;
    }

    if (mavenProperties && (mavenProperties instanceof Array)) {
        if (mavenProperties.length == 1 && mavenProperties[0].trim().length == 0) {
             // Ignore if settings value is empty like "" or " "
            logger.logProjectInfo("The maven properties list is empty, the setting will be ignored.", projectID);
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
            logger.logProjectInfo("The maven properties list remains unchanged: " + mavenProperties, projectID);
            return;
        }
        const keyValuePair: UpdateProjectInfoPair = {
            key: "mavenProperties",
            value: mavenProperties,
            saveIntoJsonFile: true
        };
        projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);
        logger.logProjectTrace("changeMavenProperties API: The projectInfo has been updated: " + JSON.stringify(projectInfo), projectInfo.projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            mavenProperties: mavenProperties,
            status: "success"
        };
        io.emitOnListener("projectSettingsChanged", data);
    } else {
        logger.logProjectInfo("The maven properties list cannot be set for a non-Maven project: " + projectType, projectInfo.projectID);
            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                mavenProperties: mavenProperties,
                status: "failed",
                error: "The maven properties list cannot be set for a non-Maven project: " + projectType
            };
            io.emitOnListener("projectSettingsChanged", data);
            return;
    }

    return;
};

/**
 * @function
 * @description Reconfig the statusPingTimeout for a project.
 *
 * @param statusPingTimeout <Required | string> - Required value for reconfiguration of statusPingTimeout.
 * @param operation <Required | Operation> - Operation object for the project.
 *
 * @returns Promise<any>
 */
const changeStatusPingTimeout = async function (statusPingTimeout: string, operation: Operation): Promise<any> {

    const projectInfo: ProjectInfo = operation.projectInfo;
    const projectID = projectInfo.projectID;
    const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
    // make sure the value we saved in projectinfo is an integer
    let pingTimeoutInt: number = parseInt(statusPingTimeout, 10);

    if (isNaN(pingTimeoutInt)) {
        // Set the changeStatusPingTimeout to the default changeStatusPingTimeout if available else 30 if default one is undefined
        if (projectHandler.getDefaultPingTimeout()) {
            pingTimeoutInt = projectHandler.getDefaultPingTimeout();
        } else {
            pingTimeoutInt = 30;
        }
        logger.logProjectInfo("The statusPingTimeout is empty, setting to the default statusPingTimeout: " + pingTimeoutInt, projectID);
    }

    if (projectInfo.statusPingTimeout !== pingTimeoutInt) {
        const keyValuePair: UpdateProjectInfoPair = {
                key: "statusPingTimeout",
                value: pingTimeoutInt,
                saveIntoJsonFile: true
        };
        operation.projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);

        // Delete the project from the array to show the next ping message
        if (projectUtil.firstTimePingArray.indexOf(projectID) > -1) {
            projectUtil.firstTimePingArray.splice(projectUtil.firstTimePingArray.indexOf(projectID), 1);
        }
        projectStatusController.pingCountMap.delete(projectID);

        const data: ProjectSettingsEvent = {
            operationId: operation.operationId,
            projectID: projectID,
            statusPingTimeout: pingTimeoutInt,
            status: "success"
        };
        io.emitOnListener("projectSettingsChanged", data);

    } else {
        logger.logProjectInfo("The statusPingTimeout is already set to: " + pingTimeoutInt, projectID);
    }

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
    logger.logProjectTrace("Project settings invoked for project ", projectID);
    logger.logProjectTrace("Project settings are " + JSON.stringify(settings), projectID);

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
            const errorMsg = `BAD_REQUEST: ${key} is not a configurable setting.`;
            logger.logProjectError(errorMsg, projectID);

            const data: ProjectSettingsEvent = {
                operationId: operation.operationId,
                projectID: projectID,
                status: "failed",
                error: errorMsg
            };
            io.emitOnListener("projectSettingsChanged", data);
        } else {
            if (settings[key] == undefined) {
                const errorMsg = "BAD_REQUEST: Each setting must have a name and a value.";
                logger.logProjectError(errorMsg, projectID);
                const data: ProjectSettingsEvent = {
                    operationId: operation.operationId,
                    projectID: projectID,
                    status: "failed",
                    error: errorMsg
                };
                io.emitOnListener("projectSettingsChanged", data);
                continue;
            }
            await specificationSettingMap.get(key)(settings[key], operation);
        }
    }

    logger.logProjectTrace(`${projectID} Project settings API operation ID: ${operation.operationId}`, projectID);
    return { "operationId": operation.operationId };
}


specificationSettingMap.set("internalDebugPort", changeInternalDebugPort);
specificationSettingMap.set("internalPort", changeInternalPort);
specificationSettingMap.set("contextRoot", changeContextRoot);
specificationSettingMap.set("healthCheck", changeHealthCheck);
specificationSettingMap.set("mavenProfiles", changeMavenProfiles);
specificationSettingMap.set("mavenProperties", changeMavenProperties);
specificationSettingMap.set("ignoredPaths", reconfigIgnoredFilesForDaemon);
specificationSettingMap.set("isHttps", reconfigWWWProtocol);
specificationSettingMap.set("statusPingTimeout", changeStatusPingTimeout);
