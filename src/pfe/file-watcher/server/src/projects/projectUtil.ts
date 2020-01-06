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
import * as crypto from "crypto";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import moment from "moment-timezone";
import * as path from "path";
import { TransformOptions } from "stream";
import { promisify } from "util";
const readDirAsync = promisify(fs.readdir);
const lstatAsync = promisify(fs.lstat);
const writeFileAsync = promisify(fs.writeFile);
const appendFileAsync = promisify(fs.appendFile);

import * as dockerutil from "../utils/dockerutil";
import * as io from "../utils/socket";
import * as kubeutil from "../utils/kubeutil";
import * as logger from "../utils/logger";
import * as workspaceSettings from "../utils/workspaceSettings";
import * as processManager from "../utils/processManager";
import * as projectsController from "../controllers/projectsController";
import * as projectStatusController from "../controllers/projectStatusController";
import { AppState, BuildState, STATE_TYPES } from "../controllers/projectStatusController";
import * as projectExtensions from "../extensions/projectExtensions";
import * as utils from "../utils/utils";
import * as logHelper from "../projects/logHelper";

import { Operation } from "./operation";
import { AppLog, BuildLog, BuildRequest, ProjectInfo, UpdateProjectInfoPair } from "./Project";
import { projectConstants, ContainerStates, StartModes, MavenFlags } from "./constants";
import * as locale from "../utils/locale";
import { appStateMap, DetailedAppStatus } from "../controllers/projectStatusController";

const Client = require("kubernetes-client").Client; // tslint:disable-line:no-require-imports
const config = require("kubernetes-client").config; // tslint:disable-line:no-require-imports
let k8sClient: any = undefined;

if (process.env.IN_K8) {
    k8sClient = new Client({ config: config.getInCluster(), version: "1.9"});
}

const KUBE_NAMESPACE = process.env.KUBE_NAMESPACE || "default";

const containerInfoMap = new Map();

export const containerInfoForceRefreshMap = new Map();

export const LOCAL_WORKSPACE = "/codewind-workspace";

const projectList: Array<string> = [];

const isApplicationPodUpIntervalMap = new Map();

export let pingMessage: string;

export const firstTimePingArray = new Array();

export interface ProjectEvent {
    operationId: string;
    projectID: string;
    status: string;
    error?: string;
    host?: string;
    ports?: any;
    containerId?: string;
    podName?: string;
    logs?: any;
    ignoredPaths?: string[];
    mavenProfiles?: string[];
    mavenProperties?: string[];
    contextRoot?: string;
    isHttps?: boolean;
    appBaseURL?: string;
    compositeAppName?: string;
    statusPingTimeout?: string;
}

export interface ProjectLog {
    app: Array<AppLog>;
    build: Array<BuildLog>;
}

const projectEventErrorMsgs = {
    missingImagePushRegistry: "The project will not build due to missing Image Push Registry. Run the Set Deployment Registry command to set a new Image Push Registry to build projects.",
    invalidImagePushRegistry: "Codewind cannot build projects with the current Image Push Registry. Please make sure it is a valid Image Push Registry with the appropriate permissions.",
};

/**
 * @function
 * @description Create a container for the respective project.
 *
 * @param operation <Required | Operation> - The operation to create a container.
 * @param script <Required | String> - The script to call to create the container.
 * @param command <Required | String> - The command to call for creating the container.
 *
 * @returns void
 */
export async function containerCreate(operation: Operation, script: string, command: string): Promise<void> {

    const event = "projectCreation";
    const projectLocation = operation.projectInfo.location;
    const projectID = operation.projectInfo.projectID;
    const projectName = projectLocation.split("/").pop();
    const projectType = operation.projectInfo.projectType;
    if (projectList.indexOf(projectID) === -1)
        projectList.push(projectID);

    logger.logProjectInfo("Creating container for " + operation.projectInfo.projectType + " project " + projectLocation, projectID, projectName);
    operation.containerName = await getContainerName(operation.projectInfo);
    // Refer to the comment in getLogName function for this usage
    const logName = getLogName(operation.projectInfo.projectID, projectLocation);

    const logDir = await logHelper.getLogDir(projectID, projectName);
    logger.logProjectInfo("Container name: " + operation.containerName, projectID, projectName);
    logger.logProjectInfo("Log name: " + logName, projectID, projectName);

    const projectEvent: ProjectEvent = {
        operationId: operation.operationId,
        projectID: projectID,
        status: "failed"
    };

    let imagePushRegistry: string;

    if (process.env.IN_K8 === "true" && operation.projectInfo.extensionID === undefined ) {
        imagePushRegistry = await workspaceSettings.getImagePushRegistry();
        logger.logProjectInfo("Image Push Registry: " + imagePushRegistry, projectID);

        if (!imagePushRegistry.length) {
            logger.logProjectError(projectEventErrorMsgs.missingImagePushRegistry, projectID, projectName);
            projectEvent.error = projectEventErrorMsgs.missingImagePushRegistry;
            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, projectID, BuildState.failed, "buildscripts.missingImagePushRegistry");
            io.emitOnListener(event, projectEvent);
            return;
        }

        logger.logInfo("Image Push Registry: " + imagePushRegistry);
    }

    const keyValuePair: UpdateProjectInfoPair = {
        key: "deploymentRegistry",
        value: imagePushRegistry,
        saveIntoJsonFile: true
    };
    const projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);
    logger.logTrace("The projectInfo has been updated for imagePushRegistry: " + JSON.stringify(projectInfo));

    let args = [projectLocation, LOCAL_WORKSPACE, operation.projectInfo.projectID, command,
        operation.containerName, String(operation.projectInfo.autoBuildEnabled), logName, operation.projectInfo.startMode,
        operation.projectInfo.debugPort, (operation.projectInfo.forceAction) ? String(operation.projectInfo.forceAction) : "NONE", logDir, imagePushRegistry];

        if (projectType == "liberty" || projectType == "spring") {

            let userMavenSettings;

            try {
                logger.logProjectInfo("Checking for user Maven settings", projectID, projectName);
                userMavenSettings = await getProjectMavenSettings(operation.projectInfo);
            } catch (err) {
                const errorMsg = "The project will not build due to invalid maven settings for project: " + projectName;
                logger.logProjectError(errorMsg.concat("\n  Cause: " + err.message).concat("\n " + err.stack), projectID, projectName);
                projectEvent.error = errorMsg;
                await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, projectID, BuildState.failed, "buildscripts.invalidMavenSettings");
                io.emitOnListener(event, projectEvent);
                return;
            }

            args = [projectLocation, LOCAL_WORKSPACE, operation.projectInfo.projectID, command, operation.containerName,
                String(operation.projectInfo.autoBuildEnabled), logName, operation.projectInfo.startMode, operation.projectInfo.debugPort,
                (operation.projectInfo.forceAction) ? String(operation.projectInfo.forceAction) : "NONE", logDir, imagePushRegistry, userMavenSettings];
        } else if (projectType == "odo") {
            const componentName: string = await getComponentName(projectName);

            args = [
                projectLocation,
                operation.projectInfo.projectID,
                command,
                operation.projectInfo.language,
                componentName,
                logDir,
                String(operation.projectInfo.autoBuildEnabled)
            ];
        }

    executeBuildScript(operation, script, args, event);

}

/**
 * @function
 * @description Update a container for the respective project.
 *
 * @param operation <Required | Operation> - The operation to update a container.
 * @param script <Required | String> - The script to call to update the container.
 * @param command <Required | String> - The command to call for updating the container.
 *
 * @returns void
 */
export async function containerUpdate(operation: Operation, script: string, command: string): Promise<void> {

    const event = "projectChanged";

    const projectLocation = operation.projectInfo.location;
    const projectID = operation.projectInfo.projectID;
    const projectName = projectLocation.split("/").pop();
    const projectType = operation.projectInfo.projectType;
    logger.logProjectInfo("Updating container for " + operation.projectInfo.projectType + " project " + projectLocation, projectID, projectName);
    operation.containerName = await getContainerName(operation.projectInfo);
    // Refer to the comment in getLogName function for this usage
    const logName = getLogName(operation.projectInfo.projectID, projectLocation);

    const logDir = await logHelper.getLogDir(projectID, projectName);
    logger.logProjectInfo("Container name: " + operation.containerName, projectID, projectName);
    logger.logProjectInfo("Log name: " + logName, projectID, projectName);

    logger.logProjectInfo("forceAction: " + operation.projectInfo.forceAction, projectID, projectName);

    const projectEvent: ProjectEvent = {
        operationId: operation.operationId,
        projectID: projectID,
        status: "failed"
    };

    let imagePushRegistry: string;

    if (process.env.IN_K8 === "true" && operation.projectInfo.extensionID === undefined ) {
        imagePushRegistry = await workspaceSettings.getImagePushRegistry();
        logger.logProjectInfo("Image Push Registry: " + imagePushRegistry, projectID);

        if (!imagePushRegistry.length) {
            logger.logProjectError(projectEventErrorMsgs.missingImagePushRegistry, projectID, projectName);
            projectEvent.error = projectEventErrorMsgs.missingImagePushRegistry;
            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, projectID, BuildState.failed, "buildscripts.missingImagePushRegistry");
            io.emitOnListener(event, projectEvent);
            return;
        }

        logger.logInfo("Image Push Registry: " + imagePushRegistry);
    }

    const keyValuePair: UpdateProjectInfoPair = {
        key: "deploymentRegistry",
        value: imagePushRegistry,
        saveIntoJsonFile: true
    };
    const projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);
    logger.logTrace("The projectInfo has been updated for imagePushRegistry: " + JSON.stringify(projectInfo));

    let args = [projectLocation, LOCAL_WORKSPACE, operation.projectInfo.projectID, command, operation.containerName,
        String(operation.projectInfo.autoBuildEnabled), logName, operation.projectInfo.startMode, operation.projectInfo.debugPort,
        (operation.projectInfo.forceAction) ? String(operation.projectInfo.forceAction) : "NONE", logDir, imagePushRegistry];

    if (projectType == "liberty" || projectType == "spring") {

        let userMavenSettings;

        try {
            logger.logProjectInfo("Checking for user Maven settings", projectID, projectName);
            userMavenSettings = await getProjectMavenSettings(operation.projectInfo);
        } catch (err) {
            const errorMsg = "The project will not build due to invalid maven settings for project: " + projectName;
            logger.logProjectError(errorMsg.concat("\n  Cause: " + err.message).concat("\n " + err.stack), projectID, projectName);
            projectEvent.error = errorMsg;
            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, projectID, BuildState.failed, "buildscripts.invalidMavenSettings");
            io.emitOnListener(event, projectEvent);
            return;
        }

        args = [projectLocation, LOCAL_WORKSPACE, operation.projectInfo.projectID, command, operation.containerName,
            String(operation.projectInfo.autoBuildEnabled), logName, operation.projectInfo.startMode, operation.projectInfo.debugPort,
            (operation.projectInfo.forceAction) ? String(operation.projectInfo.forceAction) : "NONE", logDir, imagePushRegistry, userMavenSettings];
    } else if (projectType == "odo") {
        const componentName: string = await getComponentName(projectName);

        args = [
            projectLocation,
            operation.projectInfo.projectID,
            command,
            operation.projectInfo.language,
            componentName,
            logDir,
            String(operation.projectInfo.autoBuildEnabled)
        ];
    }

    executeBuildScript(operation, script, args, event);

}

/**
 * @function
 * @description Execute the build script for the respective project.
 *
 * @param operation <Required | Operation> - The operation to excute the build script.
 * @param script <Required | String> - The script to run.
 * @param args <Required | String[]> - Require arguments to pass to the script.
 * @param event <Required | String> - The event to watch.
 *
 * @returns Promise<void>
 */
async function executeBuildScript(operation: Operation, script: string, args: Array<string>, event: string): Promise<void> {
    const projectID = operation.projectInfo.projectID;
    const projectLocation = operation.projectInfo.location;
    const projectName = projectLocation.split("/").pop();
    const projectInfo = {
        operationId: operation.operationId,
        projectID: operation.projectInfo.projectID
    } as ProjectEvent;

    if (operation.projectInfo.ignoredPaths) {
        projectInfo.ignoredPaths = operation.projectInfo.ignoredPaths;
    }
    if (operation.projectInfo.mavenProfiles) {
        projectInfo.mavenProfiles = operation.projectInfo.mavenProfiles;
    }
    if (operation.projectInfo.mavenProperties) {
        projectInfo.mavenProperties = operation.projectInfo.mavenProperties;
    }
    if (operation.projectInfo.contextRoot) {
        projectInfo.contextRoot = operation.projectInfo.contextRoot;
    }
    if (typeof operation.projectInfo.isHttps == "boolean") {
        projectInfo.isHttps = operation.projectInfo.isHttps;
    }
    if (operation.projectInfo.statusPingTimeout) {
        projectInfo.statusPingTimeout = operation.projectInfo.statusPingTimeout.toString();
    }

    const projectMetadata = projectsController.getProjectMetadataById(projectID);
    const f = projectMetadata.infoFile;
    const keyValuePair: UpdateProjectInfoPair = {
        key: "buildRequest",
        value: false,
        saveIntoJsonFile: false
    };
    await projectsController.updateProjectInfo(projectID, keyValuePair);
    // The sentProjectInfo is introduced to prevent from setting app status to started before projectInfo has been sent to portal
    keyValuePair.key = "sentProjectInfo";
    keyValuePair.value = false;
    await projectsController.updateProjectInfo(projectID, keyValuePair);

    let argList = script + " ";
    for (const arg of args) { argList += arg + " "; }
    argList = argList.trim();
    logger.logProjectInfo("executeBuildScript with args:  {" + argList + "}, In K8 environment: " + process.env.IN_K8, projectID, projectName);

    if (process.env.IN_K8 === "true") {
        const runningProcess = processManager.spawnDetached(
            projectID,
            script,
            args,
            {},
            async (result) => {
                try {
                    if (result.exitCode !== 0) {
                        projectInfo.status = "failed";
                        const errorMsg = `The container failed to start for application ` + projectLocation;
                        logger.logProjectError("Error code: " + result.exitCode + " - " + errorMsg, projectID, projectName);

                        // Explicitly handle exit code of 1 and set the build status to failed with a failure message for any unexpected script exec errors
                        // Otherwise handle all build/app statuses in the project script and exit with 3
                        if (result.exitCode == 1) {
                            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, projectID, BuildState.failed, "buildscripts.buildFail");
                        }

                        projectInfo.error = errorMsg;
                        io.emitOnListener(event, projectInfo);
                        logger.logTrace(`Emitted event for project ${projectName}: ${event} \n` + JSON.stringify(projectInfo));
                        return;
                    }
                    logger.logProjectInfo(`The container was started successfully for application ` + projectLocation, projectID, projectName);
                    projectInfo.status = "success";

                    logger.logProjectInfo("The project location for " + operation.projectInfo.projectID + " is " + projectLocation, projectID, projectName);
                    const containerInfo = await kubeutil.getApplicationContainerInfo(operation.projectInfo, operation);
                    if (containerInfo) {
                        containerInfoMap.set(operation.projectInfo.projectID, containerInfo);
                        containerInfoForceRefreshMap.set(operation.projectInfo.projectID, false);
                        if (containerInfo.ip) {
                            projectInfo.host = containerInfo.ip;
                        }

                        projectInfo.ports = {};
                        projectInfo.podName = containerInfo.podName;

                        if (containerInfo.exposedPort) {
                            projectInfo.ports.exposedPort = containerInfo.exposedPort;
                        }
                        if (containerInfo.internalPort) {
                            projectInfo.ports.internalPort = containerInfo.internalPort;
                        }
                        logger.logProjectInfo("Found container information: " + JSON.stringify(containerInfo), projectID, projectName);
                    } else {
                        containerInfoMap.delete(operation.projectInfo.projectID);
                        containerInfoForceRefreshMap.delete(operation.projectInfo.projectID);
                        logger.logProjectInfo("No containerInfo", projectID, projectName);
                    }
                    const logs = await getProjectLogs(operation.projectInfo);
                    projectInfo.logs = logs;

                    if (operation.projectInfo.projectType == "odo") {
                        const projectHandler = await projectExtensions.getProjectHandler(operation.projectInfo);
                        const odoProjectInfo: ProjectInfo = operation.projectInfo;
                        const appBaseURL: string = (await projectHandler.getAppBaseURL(projectID)).trim();
                        const appName: string = (await projectHandler.getAppName(projectID)).trim();
                        projectInfo.appBaseURL = appBaseURL;
                        projectInfo.compositeAppName = appName;
                        odoProjectInfo.appBaseURL = appBaseURL;
                        odoProjectInfo.compositeAppName = appName;
                        await projectsController.saveProjectInfo(projectID, odoProjectInfo, true);
                    }
                    else {
                        // Retrieve the internal port from the project
                        const updatedProjectInfo: ProjectInfo = operation.projectInfo;
                        const servicePort = parseInt(containerInfo.internalPort, 10);

                        // Expose an ingress for the project
                        const baseURL = await kubeutil.exposeOverIngress(projectID, operation.projectInfo.isHttps, servicePort);

                        // Set the appBaseURL to the ingress we exposed earlier
                        projectInfo.appBaseURL = baseURL;
                        updatedProjectInfo.appBaseURL = baseURL;
                        await projectsController.saveProjectInfo(projectID, updatedProjectInfo, true);
                    }
                } catch (err) {
                    logger.logProjectError(err, projectID, projectName);
                    projectInfo.error = err;
                }
                io.emitOnListener(event, projectInfo);
                keyValuePair.key = "sentProjectInfo";
                keyValuePair.value = true;
                await projectsController.updateProjectInfo(projectID, keyValuePair);
                logger.logProjectInfo("Emitted event: " + event + "\n" + JSON.stringify(projectInfo), projectID, projectName);
                try {
                    const newprojectInfo = await getProjectInfo(projectID);
                    if (newprojectInfo.buildRequest) {
                        logger.logProjectInfo("Found build request, rebuild project " + projectID, projectID, projectName);
                        executeBuildScript(operation, script, args, "projectChanged");
                    }
                } catch (err) {
                    logger.logProjectError("Failed to get project info: " + err, projectID, projectName);
                }
            }
        );
        logger.logProjectInfo("Now tracking running process " + runningProcess.pid + " for project " + projectInfo.projectID, projectID, projectName);
    } else {
        const runningProcess = processManager.spawnDetached(
            projectID,
            script,
            args,
            {},
            async (result) => {
                try {
                    if (result.exitCode !== 0) {
                        projectInfo.status = "failed";
                        const errorMsg = `The container failed to start for application ` + projectLocation;
                        logger.logProjectError("Error code: " + result.exitCode + " - " + errorMsg, projectID, projectName);

                        // Explicitly handle exit code of 1 and set the build status to failed with a failure message for any unexpected script exec errors
                        // Otherwise handle all build/app statuses in the project script and exit with 3
                        if (result.exitCode == 1) {
                            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, projectID, BuildState.failed, "buildscripts.buildFail");
                        }

                        projectInfo.error = errorMsg;
                        await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, projectID, BuildState.failed, "buildscripts.buildFail");
                        io.emitOnListener(event, projectInfo);
                        logger.logProjectInfo("Emitted event: " + event + "\n" + JSON.stringify(projectInfo), projectID, projectName);
                        return;
                    }
                    logger.logProjectInfo(`The container was started successfully for application ` + projectLocation, projectID, projectName);
                    projectInfo.status = "success";

                    logger.logProjectInfo("Looking up container information for " + operation.containerName, projectID, projectName);
                    const containerInfo = await dockerutil.getApplicationContainerInfo(operation.projectInfo, operation.containerName);
                    if (containerInfo) {
                        containerInfoMap.set(operation.projectInfo.projectID, containerInfo);
                        containerInfoForceRefreshMap.set(operation.projectInfo.projectID, false);
                        projectInfo.host = containerInfo.ip;
                        projectInfo.ports = {};
                        projectInfo.containerId = containerInfo.containerId;

                        if (containerInfo.exposedPort) {
                            projectInfo.ports.exposedPort = containerInfo.exposedPort;
                        }
                        if (containerInfo.internalPort) {
                            projectInfo.ports.internalPort = containerInfo.internalPort;
                        }
                        if (operation.projectInfo.debugPort) {
                            projectInfo.ports.internalDebugPort = operation.projectInfo.debugPort;
                        }
                        if (containerInfo.exposedDebugPort) {
                            projectInfo.ports.exposedDebugPort = containerInfo.exposedDebugPort;
                        }
                        if (containerInfo.internalDebugPort) {
                            projectInfo.ports.internalDebugPort = containerInfo.internalDebugPort;
                        }
                        logger.logProjectInfo("Found container information: " + JSON.stringify(containerInfo), projectID, projectName);
                    } else {
                        containerInfoMap.delete(operation.projectInfo.projectID);
                        containerInfoForceRefreshMap.delete(operation.projectInfo.projectID);
                        logger.logProjectInfo("No containerInfo", projectID, projectName);
                    }
                    const logs = await getProjectLogs(operation.projectInfo);
                    projectInfo.logs = logs;
                } catch (err) {
                    logger.logProjectError(err, projectID, projectName);
                    projectInfo.error = err;
                }
                io.emitOnListener(event, projectInfo);
                keyValuePair.key = "sentProjectInfo";
                keyValuePair.value = true;
                await projectsController.updateProjectInfo(projectID, keyValuePair);
                logger.logProjectInfo("Emitted event: " + event + "\n" + JSON.stringify(projectInfo), projectID, projectName);
                try {
                    const newprojectInfo = await getProjectInfo(projectID);
                    if (newprojectInfo.buildRequest) {
                        logger.logProjectInfo("Found build request, rebuild project " + projectID, projectID, projectName);
                        executeBuildScript(operation, script, args, "projectChanged");
                    }
                } catch (err) {
                    logger.logProjectError("Failed to get project info: " + err, projectID, projectName);
                }
            }
        );
        logger.logProjectInfo("Now tracking running process " + runningProcess.pid + " for project " + projectInfo.projectID, projectID, projectName);
    }
}

/**
 * @function
 * @description Get the Maven settings for a project from projectInfo.
 *
 * @param projectInfo <Required | projectInfo> - The projectInfo for a project.
 *
 * @returns string
 */
export async function getProjectMavenSettings(projectInfo: ProjectInfo): Promise<string> {

    logger.logProjectInfo("mavenProfiles: " + projectInfo.mavenProfiles, projectInfo.projectID);
    logger.logProjectInfo("mavenProperties: " + projectInfo.mavenProperties, projectInfo.projectID);

    const profilesArr = projectInfo.mavenProfiles;

    const propertiesArr = projectInfo.mavenProperties;

    let userMavenSettings = "";

    if (profilesArr && profilesArr.length > 0) {
        if (! (profilesArr.length == 1 && profilesArr[0] == "") ) {
            userMavenSettings = userMavenSettings.concat(MavenFlags.profile.concat(profilesArr.toString()));
        }
    }

    if (propertiesArr && propertiesArr.length > 0) {
        if (!(propertiesArr.length == 1 && propertiesArr[0] == "")) {
            let properties = "";
            for (const value of propertiesArr) {
                properties = properties.concat(MavenFlags.properties).concat(value);
                properties = properties.concat(" ");
            }
            userMavenSettings = userMavenSettings.concat(" ").concat(properties);
        }
    }

    if (userMavenSettings.includes("&") || userMavenSettings.includes(";")) {
        const errorMsg = "The user maven settings have invalid characters for the project";
        throw new Error(errorMsg);
    }

    logger.logProjectInfo("Project Maven Settings: " + userMavenSettings, projectInfo.projectID);
    return userMavenSettings;
}

/**
 * @function
 * @description Get project logs for the respective project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<ProjectLog>
 */
export async function getProjectLogs(projectInfo: ProjectInfo): Promise<ProjectLog> {
    const projectID = projectInfo.projectID;
    const projectLocation = projectInfo.location;
    const projectName = projectLocation.split("/").pop();
    const projectType = projectInfo.projectType;
    const projectLogDir = await logHelper.getLogDir(projectID, projectName);
    const logDirectory = path.join(projectConstants.projectsLogDir, projectLogDir);
    const containerName = await getContainerName(projectInfo);

    let applogs: Array<AppLog>;
    let buildlogs: Array<BuildLog>;
    const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
    const identifier = projectHandler.constructor.name === undefined ? projectType : projectHandler.constructor.name;

    if (projectHandler.getLogs) {
        // get the build logs
        buildlogs = await projectHandler.getLogs("build", logDirectory, projectID, containerName);
        logger.logProjectInfo("buildlog path:\n " + JSON.stringify(buildlogs), projectID, projectName);

        // get the app logs
        applogs = await projectHandler.getLogs("app", logDirectory, projectID, containerName);
        logger.logProjectInfo("applog path:\n" + JSON.stringify(applogs), projectID, projectName);
    } else {
        logger.logProjectInfo(identifier + " projects do not specify logs functionality.", projectID);
    }

    const logs: ProjectLog = {
        build: buildlogs,
        app: applogs
    };

    return logs;
}

/**
 * @function
 * @description Delete the project container.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 * @param script <Required | String> - The script to run.
 *
 * @returns Promise<void>
 */
export async function containerDelete(projectInfo: ProjectInfo, script: string): Promise<void> {

    const projectID = projectInfo.projectID;
    const projectName = projectInfo.location.split("/").pop();
    const containerName = await getContainerName(projectInfo);
    const imagePushRegistry = projectInfo.deploymentRegistry;
    logger.logProjectInfo("containerDelete: Kill running processes and remove container... ", projectID, projectName);
    logger.logProjectInfo("Project ID:        " + projectInfo.projectID, projectID, projectName);
    logger.logProjectInfo("Project Location:  " + projectInfo.location, projectID, projectName);
    logger.logProjectInfo("Project Type:      " + projectInfo.projectType, projectID, projectName);
    logger.logProjectInfo("Project Container: " + containerName, projectID, projectName);
    logger.logProjectInfo("projectInfo.deploymentRegistry: " + imagePushRegistry, projectID);

    processManager.killRunningProcesses(projectInfo.projectID, projectName);

    try {
        let args: any[] = [projectInfo.location, LOCAL_WORKSPACE, projectID, "remove", containerName, undefined, undefined, undefined, undefined, undefined, undefined, imagePushRegistry];

        if (projectInfo.projectType == "odo") {
            const logDir: string = await logHelper.getLogDir(projectID, projectName);
            const componentName: string = await getComponentName(projectName);

            args = [
                projectInfo.location,
                projectInfo.projectID,
                "remove",
                projectInfo.language,
                componentName,
                logDir,
                String(projectInfo.autoBuildEnabled)
            ];
        }

        await processManager.spawnDetachedAsync(
            projectInfo.projectID,
            script,
            args,
            {}
        );
    } catch (err) {
        const msg = "Project deletion encountered an error for project " + projectInfo.projectID;
        logger.logProjectError(msg, projectID, projectName);
    }

    containerInfoMap.delete(projectInfo.projectID);
    containerInfoForceRefreshMap.delete(projectInfo.projectID);

    if (process.env.IN_K8 === "true") {
        logger.logProjectInfo(`Removing dangling images for ${projectInfo.projectID}`, projectInfo.projectID);
        dockerutil.removeDanglingImages();
    }
}

/**
 * @function
 * @description Get the log name of a project id.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param projectLocation <Required | String> - The project location directory.
 *
 * @returns string
 */
export function getLogName(projectID: string, projectLocation: string): string {

    // This function generates the exact same name as the containerName when
    // we had the hash logic in the container names. This is because portal
    // is looking for existing project's logname in .inf file. So in order to
    // maintain backward compatibilty, we're using the old logic for log names
    // This is essentially a copy-paste of the prev getDefaultContainerName function.

    const hash = crypto.createHash("sha1", <TransformOptions>"utf8").update(projectLocation);

    let logName = projectConstants.containerPrefix + projectID + "-" + hash.digest("hex");
    const projectName = projectLocation.split("/").pop();

    if (process.env.IN_K8 === "true" && logName.length > 53) {
        logName = logName.substring(0, 53);
    }

    logger.logProjectInfo("The log name for " + projectID + " is " + logName, projectID, projectName);
    return logName;
}

/**
 * @function
 * @description Uses a project's ID and location with the container naming pattern to return a reproducible container name for the project.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param projectLocation <Required | String> - The project location directory.
 *
 * @returns string
 */
export function getDefaultContainerName(projectID: string, projectLocation: string): string {

    if (projectLocation.endsWith("/")) {
        projectLocation = projectLocation.slice(0, -1);
    }

    // Sanitize project name to ensure project name only supports lower case letter and number
    const projectNameOrigin: string = path.basename(projectLocation);
    const letterNumber: RegExp = /[A-Za-z0-9]/;
    const upperCaseLetter: RegExp = /[A-Z]/;
    const defaultProjectName: string = "cw";
    let projectName: string = "";

    for (let index = 0; index < projectNameOrigin.length; index++) {
        if (projectNameOrigin.charAt(index).match(letterNumber)) {
            if (projectNameOrigin.charAt(index).match(upperCaseLetter)) {
                projectName += projectNameOrigin.charAt(index).toLowerCase();
            } else {
                projectName += projectNameOrigin.charAt(index);
            }
        }
    }

    if (projectName.length === 0) {
        projectName = defaultProjectName;
    }

    let containerName = projectConstants.containerPrefix + projectName + "-" + projectID;

    if (process.env.IN_K8) {
        projectName = projectName.substring(0, 23);
        projectID = projectID.substring(0, 23);

        containerName = projectConstants.containerPrefix + projectName + "-" + projectID;

        // Kubernetes has a limit of 53 characters for release names so truncate as necessary
        if (containerName.length > 53) {
            containerName = containerName.substring(0, 53);
        }

        if (containerName.endsWith("-")) {
            containerName = containerName.slice(0, -1);
        }
    }

    return containerName;
}

/**
 * @function
 * @description Uses a project's info with the container naming pattern to return a reproducible container name for the project.
 * This version uses a project handler's getContainerName function if available.
 *
 * @param projectInfo <Required | ProjectInfo> - Project info.
 *
 * @returns string
 */
export async function getContainerName(projectInfo: ProjectInfo): Promise<string> {

    const projectID: string = projectInfo.projectID;
    const projectLocation: string = projectInfo.location;

    const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
    if (projectHandler && projectHandler.hasOwnProperty("getContainerName") && typeof projectHandler.getContainerName === "function") {
        return projectHandler.getContainerName(projectID, projectLocation);
    }

    return getDefaultContainerName(projectID, projectLocation);
}

/**
 * @function
 * @description Use project name to get component name that used for odo extension.
 *
 * @param projectName <Required | string> - Project name.
 *
 * @returns Promise<string>
 */
export async function getComponentName(projectName: string): Promise<string> {
    return "cw-" + projectName;
}

/**
 * @function
 * @description Get the container info for a project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 * @param forceRefresh <Required | Boolean> - Force refresh on the container. Default = false.
 *
 * @returns Promise<kubeutil.PodInfo | dockerutil.ContainerInfo>
 */
export async function getContainerInfo(projectInfo: ProjectInfo, forceRefresh: boolean = false): Promise<kubeutil.PodInfo | dockerutil.ContainerInfo> {
    const projectID = projectInfo.projectID;
    let containerInfo: kubeutil.PodInfo | dockerutil.ContainerInfo;
    if (!forceRefresh) {
        containerInfo = containerInfoMap.get(projectInfo.projectID);
        if (containerInfo) {
            return containerInfo;
        }
    }
    const containerName = await getContainerName(projectInfo);
    if (process.env.IN_K8 === "true") {
        const operation = new Operation("general", projectInfo);
        operation.containerName = containerName;
        containerInfo = await kubeutil.getApplicationContainerInfo(projectInfo, operation);
    } else {
        containerInfo = await dockerutil.getApplicationContainerInfo(projectInfo, containerName);
    }
    // Only cache the container info if it is complete
    if (containerInfo && process.env.IN_K8 ? containerInfo.serviceName : containerInfo.ip && containerInfo.internalPort) {
        containerInfoMap.set(projectInfo.projectID, containerInfo);

        // Set the containerInfo Force Refresh Map to false, since it has been refereshed
        containerInfoForceRefreshMap.set(projectID, false);
    }
    return containerInfo;
}

/**
 * @function
 * @description Find out if the internal debug port has changed for a project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<boolean>
 */
export async function hasDebugPortChanged(projectInfo: ProjectInfo): Promise<boolean> {

    const containerName = await getContainerName(projectInfo);
    if (process.env.IN_K8 === "true") {
        // do nothing for now, since Kubernetes does not support debug mode
        return false;
    } else {
        return await dockerutil.hasDebugPortChanged(projectInfo, containerName);
    }
}



/**
 * @function
 * @description Get project info for a project id.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns Promise<ProjectInfo>
 */
export async function getProjectInfo(projectID: string, ignoreLog?: boolean): Promise<ProjectInfo> {
    const projectMetadata = projectsController.getProjectMetadataById(projectID);
    const projectInfo = await projectsController.getProjectInfoFromFile(projectMetadata.infoFile, ignoreLog);
    return projectInfo;
}

/**
 * @function
 * @description Get info for all active projects.
 *
 * @param handler <Required | Any> - Selected project handler.
 *
 * @returns Promise<void>
 */
export async function getAllProjectInfo(handler: any): Promise<void> {
    const projectsDataDir = projectConstants.projectsDataDir;
    if (! await utils.asyncFileExists(projectsDataDir)) {
        logger.logInfo("The project folder does not exist yet: " + projectsDataDir);
        return;
    }

    logger.logInfo("Looking up project files in " + projectsDataDir);
    try {
        const folders = await readDirAsync(projectsDataDir);
        folders.forEach(async (folder: string) => {
            const currentFolder = projectsDataDir + folder;
            const stats = await lstatAsync(currentFolder);
            if (stats.isDirectory()) {
                const subFiles = await readDirAsync(currentFolder);
                subFiles.forEach(async (subfile: string) => {
                    if (subfile === folder + ".json") {
                        const f = currentFolder + "/" + subfile;

                        logger.logInfo("Getting project info from: " + subfile);
                        const projectInfo = await projectsController.getProjectInfoFromFile(f);

                        logger.logInfo("Project info for file " + subfile + " is: " + projectInfo);
                        if (projectInfo) {
                            handler(projectInfo);
                        }
                    }
                });
            }
        });
    } catch (err) {
        logger.logError("Error getting info for all projects in " + projectsDataDir);
        logger.logError(err);
    }
}

/**
 * @function
 * @description Check that the project container is active.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param handler <Required | Any> - Selected project handler.
 *
 * @returns Promise<void>
 */
export async function isContainerActive(projectID: string, handler: any): Promise<void> {
    try {
        const projectInfo = await getProjectInfo(projectID);
        if (!projectInfo) {
            handler({ error: await locale.getTranslation("projectUtil.projectInfoError") });
            return;
        }

        const containerName = await getContainerName(projectInfo);
        let containerState = undefined;
        if (process.env.IN_K8 === "true") {
            containerState = await kubeutil.isContainerActive(containerName, projectInfo);
        } else {
            containerState = await dockerutil.isContainerActive(containerName);
        }

        // If the container is active then check for project specific container status
        if (containerState.hasOwnProperty("state") && containerState.state === ContainerStates.containerActive) {
            const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
            if (projectHandler.hasOwnProperty("getContainerStatus")) {
                projectHandler.getContainerStatus(projectInfo, containerName, async (err: Error, state: ContainerStates) => {
                    const errMsg = (err) ? await locale.getTranslation("projectUtil.appStatusError.errorGetContainerStatus", { errMsg: err.toString() }) : undefined;
                    handler({ state: state, error: errMsg });
                });
            } else {
                handler(containerState);
            }
        } else {
            handler(containerState);
        }
    } catch (err) {
        const msg = "Error getting container status: " + err;
        logger.logError(msg);
    }
}

/**
 * @function
 * @description Ping an application to determine its current state.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param handler <Required | Any> - Selected project handler.
 *
 * @returns Promise<void>
 */
export async function isApplicationUp(projectID: string, handler: any): Promise<void> {
    try {
        const ignoreLog = true;
        const projectInfo = await getProjectInfo(projectID, ignoreLog);
        if (!projectInfo) {
            handler({ error: await locale.getTranslation("projectUtil.projectInfoError") });
            return;
        }

        const containerInfo: kubeutil.PodInfo | dockerutil.ContainerInfo = await getContainerInfo(projectInfo, containerInfoForceRefreshMap.get(projectInfo.projectID));
        if (!containerInfo) {
            handler({ error: await locale.getTranslation("projectUtil.appStatusError.errorGetContainerInfo") });
            return;
        }

        const port = containerInfo.internalPort;

        // If no ip or port then application is not running
        if (!port) {
            handler({ error: await locale.getTranslation("projectUtil.appStatusError.errorGetPort") });
            return;
        }

        if (process.env.IN_K8 !== "true" && !containerInfo.ip) {
            handler({ error: await locale.getTranslation("projectUtil.appStatusError.errorGetIP") });
            return;
        } else if (process.env.IN_K8 === "true" && !containerInfo.serviceName) {
            handler({ error: await locale.getTranslation("projectUtil.appStatusError.errorGetHostname") });
            return;
        }

        const defaultPath = "/health";
        let isDefaultPath: boolean = true;
        let path: string = defaultPath;

        if (projectInfo.contextRoot) {
            isDefaultPath = false;
            path = projectInfo.contextRoot;
        }

        if (projectInfo.healthCheck) {
            isDefaultPath = false;
            path = projectInfo.healthCheck;
        }
        // only update the detailed status on first time ping
        if (firstTimePingArray.indexOf(projectID) < 0) {
            firstTimePingArray.push(projectID);
            if (isDefaultPath) {
                updateDetailedAppStatus(projectID, containerInfo.ip, port, path, isDefaultPath);
            } else {
                updateDetailedAppStatus(projectID, containerInfo.ip, port, path);
            }
        }

        // default value of isHttps is false, overwrite if we have valid projectInfo.isHttps
        let isHttps: boolean = false;
        if (typeof projectInfo.isHttps == "boolean") {
            isHttps = projectInfo.isHttps;
        }

        const protocol = isHttps ? https : http;

        // Try to ping the application
        const options: any = {
            hostname: containerInfo.ip,
            port: port,
            path: path,
            method: "GET",
            timeout: 1000
        };

        if (isHttps) {
            options.rejectUnauthorized = false;
            options.secure = true;
        }

        if (process.env.IN_K8) {
            options.hostname = containerInfo.serviceName;
        }

        // For node.js applications, even if a response is received a timeout event can
        // still be sent so protect against this
        let statusCode: number = undefined;
        let isGoodStatusCode: Boolean = undefined;

        protocol.request(options, async (res) => {
            statusCode = res.statusCode;

            // We consider the app to be running if we get any non-error status code.
            isGoodStatusCode = statusCode >= 200 && statusCode < 400;

            if (isGoodStatusCode) {
                handler({ isAppUp: true });
            } else if (!isGoodStatusCode && path === "/health") {
                options.path = "/";

                protocol.request(options, async (res) => {
                    statusCode = res.statusCode;

                    // We consider the app to be running if we get any non-error status code.
                    isGoodStatusCode = statusCode >= 200 && statusCode < 400;

                    if (!isGoodStatusCode) {
                        handler({ isAppUp: false, error: await locale.getTranslation("projectUtil.appStatusError.badStatusCode", { statusCode: statusCode}) });
                    } else {
                        handler({ isAppUp: true });
                    }
                }).on("error", async (err) => {
                    handler({ isAppUp: false, error: await locale.getTranslation("projectUtil.appStatusError.errorGetAppStatus", { errMsg: err.message }) });
                }).on("timeout", async () => {
                    if (!statusCode) {
                        handler({ isAppUp: false, error: await locale.getTranslation("projectUtil.appStatusError.httpRequestTimeout") });
                    }
                }).end();
            } else {
                handler({ isAppUp: false, error: await locale.getTranslation("projectUtil.appStatusError.badStatusCode", { statusCode: statusCode}) });
            }
        }).on("error", async (err) => {
            handler({ isAppUp: false, error: await locale.getTranslation("projectUtil.appStatusError.errorGetAppStatus", { errMsg: err.message }) });
        }).on("timeout", async () => {
            if (!statusCode) {
                handler({ isAppUp: false, error: await locale.getTranslation("projectUtil.appStatusError.httpRequestTimeout") });
            }
        }).end();
    } catch (err) {
        handler({ error: await locale.getTranslation("projectUtil.appStatusError.errorGetAppStatus", { errMsg: err.message }) });
    }
}

/**
 * @function
 * @description Initialize the project list.
 *
 * @returns void
 */
export function setprojectList(): void {
    getAllProjectInfo((projectInfo: ProjectInfo) => {
        if (projectInfo.projectID) {
            logger.logProjectInfo("Initialize application state map for project: " + projectInfo.projectID, projectInfo.projectID);
            projectList.push(projectInfo.projectID);
        }
    });
}

/**
 * @function
 * @description Delete a project from the project list.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns void
 */
export function deleteProjectFromList(projectID: string): void {
    const index = projectList.indexOf(projectID);
    if (index > -1) {
        projectList.splice(index, 1);
    }
}

/**
 * @function
 * @description Shut down all projects.
 *
 * @returns Promise<void>
 */
export async function shutdownProjects(): Promise<void> {
    const projectListTemp = projectList.slice();

    try {
        if (projectListTemp === undefined || projectListTemp.length === 0) {
            // projectListTemp is empty
            logger.logInfo("There are no projects with deployments");
            const data = {
                status: "success"
            };
            io.emitOnListener("filewatcherShutdown", data);
            logger.logInfo("Shutdown complete " + JSON.stringify(data));
        } else {
            // projectListTemp is not empty
            logger.logInfo("Project list: " + projectListTemp);
            projectListTemp.forEach(async projectID => {
                try {
                    await projectsController.projectDeletion(projectID).then(returnCode => {
                        switch (returnCode) {
                            case 200: {
                                logger.logInfo("DeleteProject: Project deleted " + projectID);
                                break;
                            }
                            case 404: {
                                const error = "DeleteProject: Project does not exist " + projectID;
                                logger.logError(error);
                                break;
                            }
                            case 500: {
                                const error = "DeleteProject: Internal error for project " + projectID;
                                logger.logError(error);
                                break;
                            }
                            default: {
                                logger.logError("DeleteProject: Project deletion failed with an unknown error " + projectID);
                            }
                        }
                    });

                    const index = projectListTemp.indexOf(projectID);
                    if (index > -1) {
                        projectListTemp.splice(index, 1);
                    }
                    if (projectListTemp.length == 0) {
                        const data = {
                            status: "success"
                        };
                        io.emitOnListener("filewatcherShutdown", data);
                        logger.logInfo("Shutdown complete " + JSON.stringify(data));
                    }
                } catch (err) {
                    const errMsg = "Failed to remove project " + projectID;
                    logger.logProjectError(errMsg, projectID);
                    logger.logProjectError(err, projectID);
                }
            });
        }
    } catch (err) {
        const data = {
            status: "failed",
            error: err
        };
        io.emitOnListener("filewatcherShutdown", data);
        logger.logError("Error occurred during shutdown " + err);
        logger.logError(JSON.stringify(data));
    }
}

/**
 * @function
 * @description Run a script for the respective project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 * @param script <Required | String> - The script to run.
 * @param command <Required | String> - The command to execute.
 *
 * @returns Promise<processManager.ProcessResult>
 */
export async function runScript(projectInfo: ProjectInfo, script: string, command: string): Promise<processManager.ProcessResult> {

    const projectID = projectInfo.projectID;
    const containerName = await getContainerName(projectInfo);
    const logName = getLogName(projectInfo.projectID, projectInfo.location);
    const logDir = await logHelper.getLogDir(projectInfo.projectID, projectInfo.projectName);
    const projectName = path.basename(projectInfo.location);
    let args = [projectInfo.location, LOCAL_WORKSPACE, projectID, command, containerName, String(projectInfo.autoBuildEnabled), logName, projectInfo.startMode,
        projectInfo.debugPort, "NONE", logDir];

    if (projectInfo.projectType == "odo") {
        const componentName: string = await getComponentName(projectName);

        args = [
            projectInfo.location,
            projectInfo.projectID,
            command,
            projectInfo.language,
            componentName,
            logDir,
            String(projectInfo.autoBuildEnabled)
        ];
    }

    return await processManager.spawnDetachedAsync(projectInfo.projectID, script, args, {});
}

/**
 * @function
 * @description Build and run a project.
 *
 * @param operation <Required | Operation> - The operation to build and run a project.
 *
 * @returns Promise<void>
 */
export async function buildAndRun(operation: Operation, command: string): Promise<void> {

    let event;

    if (command === "create") {
        event = "projectCreation";
    } else if (command == "update") {
        event = "projectChanged";
    }

    const projectLocation = operation.projectInfo.location;
    const projectID = operation.projectInfo.projectID;
    const projectName = projectLocation.split("/").pop();

    if (projectList.indexOf(projectID) === -1)
        projectList.push(projectID);

    logger.logProjectInfo("Building container for " + operation.projectInfo.projectType + " project " + projectLocation, projectID, projectName);

    operation.containerName = await getContainerName(operation.projectInfo);
    // Refer to the comment in getLogName function for this usage
    const logName = getLogName(operation.projectInfo.projectID, projectLocation);

    logger.logProjectInfo("Container name: " + operation.containerName, projectID, projectName);
    logger.logProjectInfo("Log name: " + logName, projectID, projectName);

    const projectEvent: ProjectEvent = {
        operationId: operation.operationId,
        projectID: operation.projectInfo.projectID,
        status: "failed"
    };

    if (operation.projectInfo.ignoredPaths) {
        projectEvent.ignoredPaths = operation.projectInfo.ignoredPaths;
    }
    if (operation.projectInfo.contextRoot) {
        projectEvent.contextRoot = operation.projectInfo.contextRoot;
    }
    if (typeof operation.projectInfo.isHttps == "boolean") {
        projectEvent.isHttps = operation.projectInfo.isHttps;
    }
    if (operation.projectInfo.statusPingTimeout) {
        projectEvent.statusPingTimeout = operation.projectInfo.statusPingTimeout.toString();
    }
    const buildInfo: BuildRequest = {
        projectLocation: projectLocation,
        LOCAL_WORKSPACE: LOCAL_WORKSPACE,
        projectID: projectID,
        containerName: operation.containerName,
        autoBuildEnabled: operation.projectInfo.autoBuildEnabled,
        logName: logName,
        hostPorts: [],
        containerPorts: []
    };

    const keyValuePair: UpdateProjectInfoPair = {
        key: "sentProjectInfo",
        value: false,
        saveIntoJsonFile: false
    };
    await projectsController.updateProjectInfo(projectID, keyValuePair);

    const in_k8 = process.env.IN_K8 ? "true" : "false";
    logger.logProjectInfo("In K8 environment: " + in_k8, projectID, projectName);
    if (process.env.IN_K8 === "true") {
        // Kubernetes environment
        await projectsController.updateProjectInfo(projectID, keyValuePair);

        try {
            logger.logProjectInfo("Beginning container build and run stage", projectID, projectName);
            await containerBuildAndRun(event, buildInfo, operation);
        } catch (err) {
            const errorMsg = `The container failed to start for project ` + projectName;
            logger.logProjectError(errorMsg.concat("\n  Cause: " + err.message).concat("\n " + err.stack), projectID, projectName);
            projectEvent.error = errorMsg;
            io.emitOnListener(event, projectEvent);
            return;
        }

    } else {
        // Local docker environment
        const keyValuePair: UpdateProjectInfoPair = {
            key: "buildRequest",
            value: false
        };
        await projectsController.updateProjectInfo(projectID, keyValuePair);

        try {
            logger.logProjectInfo("Beginning container build and run stage", projectID, projectName);
            await containerBuildAndRun(event, buildInfo, operation);
        } catch (err) {
            const errorMsg = `The container failed to start for project ` + projectName;
            logger.logProjectError(errorMsg.concat("\n  Cause: " + err.message).concat("\n " + err.stack), projectID, projectName);
            projectEvent.error = errorMsg;
            io.emitOnListener(event, projectEvent);
            return;
        }

        try {
            logger.logProjectInfo(`The container was started successfully for application ` + projectLocation, projectID, projectName);
            projectEvent.status = "success";

            logger.logProjectInfo("Looking up container information for " + operation.containerName, projectID, projectName);
            const containerInfo = await dockerutil.getApplicationContainerInfo(operation.projectInfo, operation.containerName);
            if (containerInfo) {
                containerInfoMap.set(operation.projectInfo.projectID, containerInfo);
                containerInfoForceRefreshMap.set(operation.projectInfo.projectID, false);
                projectEvent.host = containerInfo.ip;
                projectEvent.ports = {};
                projectEvent.containerId = containerInfo.containerId;

                if (containerInfo.exposedPort) {
                    projectEvent.ports.exposedPort = containerInfo.exposedPort;
                }
                if (containerInfo.internalPort) {
                    projectEvent.ports.internalPort = containerInfo.internalPort;
                }
                logger.logProjectInfo("Found container information: " + JSON.stringify(containerInfo), projectID, projectName);
            } else {
                containerInfoMap.delete(operation.projectInfo.projectID);
                containerInfoForceRefreshMap.delete(operation.projectInfo.projectID);
                logger.logProjectInfo("No containerInfo", projectID, projectName);
            }
            const logs = await getProjectLogs(operation.projectInfo);
            projectEvent.logs = logs;
        } catch (err) {
            logger.logProjectError(err, projectID, projectName);
            projectEvent.error = err;
        }
        keyValuePair.key = "sentProjectInfo";
        keyValuePair.value = true;
        await projectsController.updateProjectInfo(projectID, keyValuePair);

        io.emitOnListener(event, projectEvent);
        logger.logProjectInfo("Emitted event: " + event + "\n" + JSON.stringify(projectEvent), projectID, projectName);
        try {
            const newprojectInfo = await getProjectInfo(projectID);
            if (newprojectInfo.buildRequest) {
                logger.logProjectInfo("Found build request, rebuild project " + projectID, projectID, projectName);
            }
        } catch (err) {
            logger.logProjectError("Failed to get project info: " + err, projectID, projectName);
        }

        logger.logProjectInfo("Container build and run stage complete", projectID, projectName);
        // END: Local docker environment
    }
}

/**
 * @function
 * @description Container build and run for a project.
 *
 * @param buildInfo <Required | BuildRequest> - The build information object.
 *
 * @returns Promise<void>
 */
async function containerBuildAndRun(event: string, buildInfo: BuildRequest, operation: Operation): Promise<void> {
    const normalizedProjectLocation = path.resolve(buildInfo.projectLocation);
    const projectName = normalizedProjectLocation.split("/").reverse()[0];
    const logDir = await logHelper.getLogDir(buildInfo.projectID, projectName);
    const dockerBuildLog = path.resolve(buildInfo.projectLocation + "/../.logs/" + logDir, logHelper.buildLogs.dockerBuild + logHelper.logExtension);
    if (process.env.IN_K8 === "true") {
        // Kubernetes environment

        const projectEvent: ProjectEvent = {
            operationId: operation.operationId,
            projectID: buildInfo.projectID,
            status: "failed"
        };

        const imagePushRegistry: string = await workspaceSettings.getImagePushRegistry();
        logger.logProjectInfo("Image Push Registry: " + imagePushRegistry, buildInfo.projectID);

        if (!imagePushRegistry.length) {
            logger.logProjectError(projectEventErrorMsgs.missingImagePushRegistry, buildInfo.projectID, projectName);
            projectEvent.error = projectEventErrorMsgs.missingImagePushRegistry;
            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, buildInfo.projectID, BuildState.failed, "buildscripts.missingImagePushRegistry");
            io.emitOnListener(event, projectEvent);
            return;
        }

        const keyValuePair: UpdateProjectInfoPair = {
            key: "deploymentRegistry",
            value: imagePushRegistry,
            saveIntoJsonFile: true
        };
        const projectInfo = await projectsController.updateProjectInfo(buildInfo.projectID, keyValuePair);
        logger.logProjectInfo("The projectInfo has been updated for imagePushRegistry: " + JSON.stringify(projectInfo), projectInfo.projectID);

        let defaultChartLocation = buildInfo.projectLocation + "/chart";
        const dirList = await utils.asyncReadDir(defaultChartLocation);
        let chartDirCounter = 0;
        for (const chartDir of dirList) {
            // Sometimes when we are pushing images to Kubernetes, .DS_Store files also get copied. Skip them...
            if (chartDir === ".DS_Store") {
                continue;
            }
            if (chartDirCounter > 0) {
                const msg = "The chart has more than one directory. Aborting Helm Install..";
                logger.logProjectError(msg, buildInfo.projectID);
                throw Error(msg);
            }
            defaultChartLocation = defaultChartLocation + "/" + chartDir;
            chartDirCounter ++;
        }

        logger.logProjectInfo("The chart location is: " + defaultChartLocation, buildInfo.projectID);

        // Copy project chart dir to a tmp location for chart modify and helm install
        const chartName = path.basename(defaultChartLocation);
        const tempChartLocation = "/tmp/" + projectName + "/" + chartName;
        logger.logProjectInfo("Copying chart from " + defaultChartLocation + " to " + tempChartLocation, buildInfo.projectID);

        await utils.asyncCopyDir(defaultChartLocation, tempChartLocation);
        // Change defaultChartLocation to tmp chart dir and get the parent folder of the chart
        defaultChartLocation = tempChartLocation;
        const chartParentFolder = path.dirname(defaultChartLocation);

        logger.logProjectInfo("Modifying charts and running Helm install from dir " + defaultChartLocation, buildInfo.projectID);

        // Modify the temp copy of the chart to add the needed labels and serviceAccount
        try {
            // Render the chart template
            await processManager.spawnDetachedAsync(buildInfo.projectID, "helm", ["template", buildInfo.containerName, defaultChartLocation, "--values=/file-watcher/scripts/override-values.yaml", "--set", "image.repository=" + imagePushRegistry + "/" + buildInfo.containerName, "--output-dir=" + chartParentFolder], {});

            // Find the locations of the deployment and service file
            const deploymentFile = (await processManager.spawnDetachedAsync(buildInfo.projectID, "bash", ["/file-watcher/scripts/kubeScripts/find-kube-resource.sh", defaultChartLocation, "Deployment"], {})).stdout;
            if (deploymentFile.length === 0) {
                throw Error("Unable to find a deployment file in the chart.");
            }
            const serviceFile = (await processManager.spawnDetachedAsync(buildInfo.projectID, "bash", ["/file-watcher/scripts/kubeScripts/find-kube-resource.sh", defaultChartLocation, "Service"], {})).stdout;
            if (serviceFile.length === 0) {
                throw Error("Unable to find a service file in the chart.");
            }

            // Add the missing labels to the chart
            await processManager.spawnDetachedAsync(buildInfo.projectID, "bash", ["/file-watcher/scripts/kubeScripts/modify-helm-chart.sh", deploymentFile, serviceFile, buildInfo.containerName, buildInfo.projectID], {});
        }
        catch (err) {
            logger.logProjectError("Error modifying the chart to add the necessary labels", buildInfo.projectID);
            throw Error(err);
        }
        let result;

        try {
            // If there's an existing failed Helm release, delete it. See https://github.com/helm/helm/issues/3353
            result = await processManager.spawnDetachedAsync(buildInfo.projectID, "helm", ["list", "--failed", "-q"], {});
            if (result.stdout.includes(buildInfo.containerName)) {
                if (projectStatusController.getAppState(buildInfo.projectID) == projectStatusController.AppState.started) {
                    await projectStatusController.updateProjectStatus(STATE_TYPES.appState, buildInfo.projectID, AppState.stopping, "");
                }
                await kubeutil.deleteHelmRelease(buildInfo.projectID, result.stdout.trim());
            }
        } catch (err) {
            // helm list -q for an invalid release returns 1, so catch it here and log msg
            logger.logProjectInfo(err, buildInfo.projectID);
            logger.logProjectInfo("Helm Release " + buildInfo.containerName + " already deleted", buildInfo.projectID);
        }

        await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, buildInfo.projectID, BuildState.inProgress, "buildscripts.buildImage");
        try {
            logger.logProjectInfo("Build container image", buildInfo.projectID);
            const projectInfo = await getProjectInfo(buildInfo.projectID);
            const language = projectInfo.language;
            await dockerutil.buildImage(buildInfo.projectID, language, buildInfo.containerName, [], buildInfo.projectLocation, true, dockerBuildLog);
            const imageLastBuild = Date.now();
            logger.logProjectInfo("Container image build stage complete.", buildInfo.projectID);
            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, buildInfo.projectID, BuildState.inProgress, "buildscripts.containerBuildSuccess", imageLastBuild.toString());
        } catch (err) {
            const msg = "Build image stage failed for " + projectName;
            logger.logProjectError(msg, buildInfo.projectID, buildInfo.containerName);
            logger.logProjectError(err, buildInfo.projectID, buildInfo.containerName);
            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, buildInfo.projectID, BuildState.failed, "buildscripts.buildFail");
            await projectStatusController.updateProjectStatus(STATE_TYPES.appState, buildInfo.projectID, AppState.stopped, " ");
            throw new Error(msg);
        }

        try {
            // Tag and push image
            // Tag and push the docker registry image, which we will use during the helm install
            await dockerutil.tagAndPushImage(buildInfo.projectID, buildInfo.containerName, imagePushRegistry);
        } catch (err) {
            const msg = "Failed to push image to the registry for " + projectName;
            logger.logProjectError(msg, buildInfo.projectID, buildInfo.containerName);
            logger.logProjectError(err, buildInfo.projectID, buildInfo.containerName);
            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, buildInfo.projectID, BuildState.failed, "buildscripts.invalidImagePushRegistry");
            await projectStatusController.updateProjectStatus(STATE_TYPES.appState, buildInfo.projectID, AppState.stopped, " ");
            throw new Error(msg);
        }

        try {
            // Install Helm Deployment
            const installResult = await kubeutil.installChart(buildInfo.projectID, buildInfo.containerName, defaultChartLocation, imagePushRegistry);
            await appendToBuildLogFile(buildInfo, installResult.stdout, logDir);
        } catch (err) {
            const msg = "Helm chart install stage failed for " + projectName;
            logger.logProjectError(msg, buildInfo.projectID, buildInfo.containerName);
            logger.logProjectError(err, buildInfo.projectID, buildInfo.containerName);
            let buildLogMsg = msg + "\n" + err.stderr;
            if (err.stderr && err.stderr.endsWith("already exists")) {
                buildLogMsg += "\nThis can happen when two or more projects define the same resource(s) (eg. deployment) in their chart. Ensure each project defines unique resources and delete any resources left behind by previous installs.";
            }
            await appendToBuildLogFile(buildInfo, buildLogMsg, logDir);
            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, buildInfo.projectID, BuildState.failed, "buildscripts.buildFail");
            await projectStatusController.updateProjectStatus(STATE_TYPES.appState, buildInfo.projectID, AppState.stopped, " ");
            throw new Error(msg);
        }

        try {
            // If there are any terminating containers matching the project's label, delete them to ensure they go away immediately
            await processManager.spawnDetachedAsync(buildInfo.projectID, "bash", ["/file-watcher/scripts/kubeScripts/clear-terminating-pods.sh", buildInfo.containerName], {});
        } catch (err) {
            // Only log an error when this happens, don't
            logger.logProjectError("Error attempting to delete the terminating pods for the project", buildInfo.projectID);
        }

        await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, buildInfo.projectID, BuildState.success, " ");
        await projectStatusController.updateProjectStatus(STATE_TYPES.appState, buildInfo.projectID, AppState.starting, " ");

        const intervalID: NodeJS.Timer = setInterval(isApplicationPodUp, 1000, buildInfo, projectName, operation, event);
        isApplicationPodUpIntervalMap.set(buildInfo.projectID, intervalID);

    } else {
        // Local Docker
        await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, buildInfo.projectID, BuildState.inProgress, "buildscripts.buildImage");
        try {
            logger.logProjectInfo("Build container image", buildInfo.projectID);
            const projectInfo = await getProjectInfo(buildInfo.projectID);
            const language = projectInfo.language;
            await dockerutil.buildImage(buildInfo.projectID, language, buildInfo.containerName, [], buildInfo.projectLocation, true, dockerBuildLog);
            logger.logProjectInfo("Container image build stage complete.", buildInfo.projectID);
            const imageLastBuild = Date.now();
            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, buildInfo.projectID, BuildState.success, " ", imageLastBuild.toString());
            await projectStatusController.updateProjectStatus(STATE_TYPES.appState, buildInfo.projectID, AppState.starting, "");
        } catch (err) {
            const msg = "Build image stage failed for " + projectName;
            logger.logProjectError(msg, buildInfo.projectID);
            logger.logProjectError("Error output:\n" + err.stdout, buildInfo.projectID);
            await projectStatusController.updateProjectStatus(STATE_TYPES.buildState, buildInfo.projectID, BuildState.failed, "buildscripts.buildFail");
            await projectStatusController.updateProjectStatus(STATE_TYPES.appState, buildInfo.projectID, AppState.stopped, "");
            throw new Error(msg);
        }

        // start the container
        try {
            await runLocalContainer(buildInfo);
        } catch (err) {
            /* Docker run can sometimes inexplicably fail with the following error:
             *   docker: Error response from daemon: driver failed programming external connectivity
             *   on endpoint <project>: Error starting userland proxy: listen tcp 0.0.0.0:43273: bind: address already in use.
             *
             * Workaround: Retry once if we hit this error.
             */
            logger.logProjectInfo("Retrying start container stage.", buildInfo.projectID);
            try {
                await runLocalContainer(buildInfo);
            } catch (err) {
                await projectStatusController.updateProjectStatus(STATE_TYPES.appState, buildInfo.projectID, AppState.stopped, "");
            }
        }
    }
}

/**
 * @function
 * @description Run a local container.
 *
 * @param buildInfo <Required | BuildRequest> - The build information object.
 * @param buildOutput <Required | String> - The build output.
 */
async function runLocalContainer(buildInfo: BuildRequest): Promise<void> {
    const normalizedProjectLocation = path.resolve(buildInfo.projectLocation);
    const projectName = normalizedProjectLocation.split("/").reverse()[0];
    const logDir = await logHelper.getLogDir(buildInfo.projectID, projectName);
    const appLog = path.resolve(buildInfo.projectLocation + "/../.logs/" + logDir, logHelper.appLogs.app + logHelper.logExtension);
    try {
        // If there is an existing container then remove it before attempting to run a new container
        const result = await processManager.spawnDetachedAsync(buildInfo.projectID, "docker", ["ps", "-a", "-q", "-f", "name=^/" + buildInfo.containerName + "$"], {});
        if (result.stdout.length !== 0) {
            logger.logProjectInfo(buildInfo.containerName + " already exists. Removing existing container...", buildInfo.projectID);
            await processManager.spawnDetachedAsync(buildInfo.projectID, "docker", ["rm", "-f", result.stdout.trim()], {});
            logger.logProjectInfo("The existing container was successfully removed.", buildInfo.projectID);
        }

        // Check for pre-existing port mappings so that they can be reused for incremental builds
        const containerInfo = containerInfoMap.get(buildInfo.projectID);
        if (containerInfo && containerInfo.hostPorts.length > 0 && containerInfo.containerPorts.length > 0) {
            buildInfo.hostPorts = containerInfo.hostPorts;
            buildInfo.containerPorts = containerInfo.containerPorts;
        }
        logger.logProjectInfo("Starting container...", buildInfo.projectID);
        await dockerutil.runContainer(buildInfo, buildInfo.containerName);

        // stream the app container logs - Local
        logger.logProjectInfo("Streaming application logs on Local for " + buildInfo.projectID, buildInfo.projectID);
        await processManager.spawnDetachedAsync(buildInfo.projectID, "/file-watcher/scripts/dockerScripts/docker-app-log.sh", [appLog, buildInfo.containerName,
            process.env.IN_K8, buildInfo.projectID], {});

        logger.logProjectInfo("Container started successfully.", buildInfo.projectID);
    } catch (err) {
        const msg = "Start container stage failed for " + projectName;
        logger.logProjectError(msg, buildInfo.projectID, buildInfo.containerName);
        logger.logProjectError(err, buildInfo.projectID, buildInfo.containerName);
        throw new Error(msg);
    }
}

/**
 * @function
 * @description Append to the build log file.
 *
 * @param buildInfo <Required | BuildRequest> - The build information object.
 * @param buildOutput <Required | String> - The build output.
 *
 * @returns Promise<void>
 */
async function appendToBuildLogFile(buildInfo: BuildRequest, output: string, logDir: string): Promise<void> {
    // create build log
    const logDirectory = path.resolve(buildInfo.projectLocation + "/../.logs/" + logDir);
    const logPath = path.join(logDirectory, logHelper.buildLogs.dockerBuild + logHelper.logExtension);
    const timestamp = moment().tz(moment.tz.guess()).format("ddd MMM D HH:mm:ss z YYYY");
    await appendFileAsync(logPath, "\n\n" + output + "\n" + timestamp);
    logger.logProjectInfo("Build log created: " + logPath, buildInfo.projectID);
}

/**
 * @function
 * @description Check to see if the application pod is up.
 *
 * @param buildInfo <Required | BuildRequest> - The build information object.
 * @param projectName <Required | String> - The project name.
 *
 * @returns Promise<void>
 */
export async function isApplicationPodUp(buildInfo: BuildRequest, projectName: string, operation: Operation, event: string): Promise<void> {
    let isPodRunning = false;
    let isPodFailed = false;
    const releaseLabel = "release=" + buildInfo.containerName;
    const intervalID: NodeJS.Timer = isApplicationPodUpIntervalMap.get(buildInfo.projectID);
    const resp = await k8sClient.api.v1.namespaces(KUBE_NAMESPACE).pods.get({ qs: { labelSelector: releaseLabel } });

    // We are getting the list of pods by the release label
    const podInfo = resp.body;
    if (podInfo && podInfo.items && (Object.keys(podInfo.items).length > 0)) {
        for (const pod of podInfo.items) {
            if (pod.status && Object.keys(pod.status.containerStatuses).length > 0) {
                for (const containerStatus of pod.status.containerStatuses) {
                    // Container state entries are running, terminated, waiting
                    // Container waiting reasons are: ContainerCreating, CrashLoopBackOff, ErrImagePull, ImagePullBackOff
                    if (pod.status.phase && pod.status.phase == "Running" && containerStatus.state && containerStatus.state.running && pod.metadata.deletionTimestamp === undefined) {
                        isPodRunning = true;
                    } else if (containerStatus.state && containerStatus.state.waiting &&
                        containerStatus.state.waiting.reason &&
                        (containerStatus.state.waiting.reason === "CrashLoopBackOff" || containerStatus.state.waiting.reason === "ErrImagePull" || containerStatus.state.waiting.reason === "ImagePullBackOff")) {
                        logger.logProjectError("The pod for helm release " + buildInfo.containerName + " has failed to start, with reason: " + containerStatus.state.waiting.reason, buildInfo.projectID);
                        isPodFailed = true;
                    } else if (pod.status.phase && (pod.status.phase == "Failed" || pod.status.phase == "Unknown")) {
                        isPodFailed = true;
                    }
                }
            }
        }
    }

    if (isPodRunning) {
        logger.logProjectInfo("The pod for helm release " + buildInfo.containerName + " is now up", buildInfo.projectID);
        // Clear the isApplicationPodUp function interval
        logger.logProjectInfo("Clearing the isApplicationPodUp interval", buildInfo.projectID);
        clearInterval(intervalID);
        isApplicationPodUpIntervalMap.delete(buildInfo.projectID);
        getPODInfoAndSendToPortal(operation, event);
    }

    if (isPodFailed) {
        const translatedmsg = await locale.getTranslation("buildscripts.podFailedToStart", { projectName: projectName });
        logger.logProjectError(translatedmsg, buildInfo.projectID, buildInfo.containerName);
        await projectStatusController.updateProjectStatus(STATE_TYPES.appState, buildInfo.projectID, AppState.stopped, "buildscripts.podFailedToStart", undefined, undefined, translatedmsg);
        await kubeutil.printHelmStatus(buildInfo.projectID, buildInfo.containerName);
        await kubeutil.deleteHelmRelease(buildInfo.projectID, buildInfo.containerName);
        // Clear the isApplicationPodUp function interval
        logger.logProjectInfo("Clearing the isApplicationPodUp interval", buildInfo.projectID);
        clearInterval(intervalID);
        isApplicationPodUpIntervalMap.delete(buildInfo.projectID);
        getPODInfoAndSendToPortal(operation, event);
    }
}

/**
 * @function
 * @description Remove a project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function removeProject(projectInfo: ProjectInfo): Promise<void> {

    const projectID = projectInfo.projectID;
    const projectName = projectInfo.location.split("/").pop();
    const containerName = await getContainerName(projectInfo);
    logger.logProjectInfo("removeProject: Kill running processes and remove container... ", projectID, projectName);
    logger.logProjectInfo("Project ID:        " + projectInfo.projectID, projectID, projectName);
    logger.logProjectInfo("Project Location:  " + projectInfo.location, projectID, projectName);
    logger.logProjectInfo("Project Type:      " + projectInfo.projectType, projectID, projectName);
    logger.logProjectInfo("Project Container: " + containerName, projectID, projectName);

    processManager.killRunningProcesses(projectInfo.projectID, projectName);

    if (process.env.IN_K8 === "true") {
        const imagePushRegistry = projectInfo.deploymentRegistry;
        logger.logProjectInfo("projectInfo.deploymentRegistry: " + imagePushRegistry, projectID);

        const intervalID: NodeJS.Timer = isApplicationPodUpIntervalMap.get(projectInfo.projectID);
        if (intervalID != undefined) {
            // Clear the isApplicationPodUp function interval
            logger.logProjectInfo("Clearing the isApplicationPodUp interval", projectInfo.projectID);
            clearInterval(intervalID);
            isApplicationPodUpIntervalMap.delete(projectInfo.projectID);
        }
        try {
            kubeutil.deleteHelmRelease(projectInfo.projectID, containerName);
        } catch (err) {
            const msg = "Error removing deployment for project " + projectInfo.projectID;
            logger.logProjectError(msg, projectID, projectName);
        }

        // kill application log process
        await processManager.spawnDetachedAsync(projectID, "/file-watcher/scripts/dockerScripts/docker-remove.sh", [containerName, process.env.IN_K8], {});

        try {
            const result = await processManager.spawnDetachedAsync(projectInfo.projectID, "buildah", ["images", "-qa", "-f", "reference=" + containerName], {});
            // If output of the above command is not empty, handle it
            if (result.stdout.length !== 0) {
                await dockerutil.removeImage(projectInfo.projectID, result.stdout.trim());
            }
        } catch (err) {
            const msg = "Error removing image " + containerName + " and/or " + imagePushRegistry + "/" + containerName;
            logger.logProjectError(err, projectInfo.projectID);
            logger.logProjectInfo(msg, projectInfo.projectID);
        }
    } else {
        try {
            await dockerutil.removeContainer(projectInfo.projectID, containerName);
        } catch (err) {
            const msg = "Project deletion encountered an error for project " + projectInfo.projectID;
            logger.logProjectError(msg, projectID, projectName);
        }
    }

    containerInfoMap.delete(projectInfo.projectID);
    containerInfoForceRefreshMap.delete(projectInfo.projectID);

    if (process.env.IN_K8 === "true") {
        dockerutil.removeDanglingImages();
    }
}

/**
 * @function
 * @description Get a friendly representation of the project type.
 *
 * @param internalProjectType <Required | String> - An internal project type representation e.g "nodejs" -> "Node.js"
 *
 * @returns string
 */
export function getUserFriendlyProjectType(internalProjectType: string): string {
    switch (internalProjectType) {
        case "liberty":
            return "Microprofile";
        case "spring":
            return "Spring";
        case "swift":
            return "Swift";
        case "nodejs":
            return "Node.js";
        case "docker":
            // Possibly return the language? So if it's a docker, python project, return "Python" ?
            return "Docker";
        default:
            logger.logInfo("Possible extension project type " + internalProjectType);
            return internalProjectType.charAt(0).toUpperCase() + internalProjectType.slice(1);
    }
}

/**
 * @function
 * @description get running pod infomation and send back to portal through socket event.
 *
 * @param operation <Required | Operation> - Operation object for the project.
 *
 * @returns Promise<any>
 */
async function getPODInfoAndSendToPortal(operation: Operation, event: string = "projectCreation"): Promise<any> {
    const projectEvent: ProjectEvent = {
        operationId: operation.operationId,
        projectID: operation.projectInfo.projectID,
        status: "failed"
    };

    const projectInfo = operation.projectInfo;
    const projectLocation = projectInfo.location;
    const projectID = projectInfo.projectID;
    const projectName = projectInfo.projectName;
    const keyValuePair: UpdateProjectInfoPair = {
        key: "buildRequest",
        value: false
    };

    if (projectInfo.ignoredPaths) {
        projectEvent.ignoredPaths = projectInfo.ignoredPaths;
    }
    if (projectInfo.contextRoot) {
        projectEvent.contextRoot = projectInfo.contextRoot;
    }
    if (typeof projectInfo.isHttps == "boolean") {
        projectEvent.isHttps = projectInfo.isHttps;
    }

    const logDir = await logHelper.getLogDir(projectID, projectName);
    const appLog = path.resolve(projectLocation + "/../.logs/" + logDir, logHelper.appLogs.app + logHelper.logExtension);

    try {
        logger.logProjectInfo(`The container was started successfully for application ` + projectLocation, projectID, projectName);

        logger.logProjectInfo("The project location for " + projectID + " is " + projectLocation, projectID, projectName);

        const containerInfo = await kubeutil.getApplicationContainerInfo(projectInfo, operation);
        projectEvent.status = "success";
        if (containerInfo) {
            containerInfoMap.set(projectID, containerInfo);
            containerInfoForceRefreshMap.set(projectID, false);
            if (containerInfo.ip) {
                projectEvent.host = containerInfo.ip;
            }

            projectEvent.ports = {};
            projectEvent.podName = containerInfo.podName;

            if (containerInfo.exposedPort) {
                projectEvent.ports.exposedPort = containerInfo.exposedPort;
            }
            if (containerInfo.internalPort) {
                projectEvent.ports.internalPort = containerInfo.internalPort;
            }
            logger.logProjectInfo("Found container information: " + JSON.stringify(containerInfo), projectID, projectName);
        } else {
            containerInfoMap.delete(projectID);
            containerInfoForceRefreshMap.delete(projectID);
            logger.logProjectInfo("No containerInfo", projectID, projectName);
        }

        // stream the app container logs - Kubernetes
        logger.logProjectInfo("Streaming application logs on Kubernetes for " + projectID, projectID);
        await processManager.spawnDetachedAsync(projectID, "/file-watcher/scripts/dockerScripts/docker-app-log.sh", [appLog, operation.containerName,
            process.env.IN_K8, projectID], {});

        const logs = await getProjectLogs(projectInfo);
        projectEvent.logs = logs;

        // Expose an ingress for the project
        const servicePort = parseInt(containerInfo.internalPort, 10);
        const baseURL = await kubeutil.exposeOverIngress(projectID, operation.projectInfo.isHttps, servicePort);

        // Set the appBaseURL to the ingress URL of the project
        const updatedProjectInfo: ProjectInfo = operation.projectInfo;
        projectEvent.appBaseURL = baseURL;
        updatedProjectInfo.appBaseURL = baseURL;
        await projectsController.saveProjectInfo(projectID, updatedProjectInfo, true);
    } catch (err) {
        logger.logProjectError(err, projectID, projectName);
        projectEvent.error = err;
    }

    keyValuePair.key = "sentProjectInfo";
    keyValuePair.value = true;
    await projectsController.updateProjectInfo(projectID, keyValuePair);

    io.emitOnListener(event, projectEvent);
    logger.logProjectInfo("Emitted event: " + event + "\n" + JSON.stringify(projectEvent), projectID, projectName);

    try {
        const newprojectInfo = await getProjectInfo(projectID);
        if (newprojectInfo.buildRequest) {
            logger.logProjectInfo("Found build request, rebuild project " + projectID, projectID, projectName);
        }
    } catch (err) {
        logger.logProjectError("Failed to get project info: " + err, projectID, projectName);
    }

    logger.logProjectInfo("Container build and helm install stage complete", projectID, projectName);
    // END: Kubernetes environment
}


/**
 * @function
 * @description restart a project
 *
 * @param operation <Required | Operation> - Operation object for the project.
 * @param startMode <Required | string> -  The specific startMode for restarting the project.
 * @param eventName <Required | string> -  The specific socket eventName to use to send databack to portal.
 *
 * @returns Promise<any>
 */
export async function restartProject(operation: Operation, startMode: string, eventName: string): Promise<any> {
    let portNumberChanged = false;
    const projectInfo = operation.projectInfo;
    const projectID = projectInfo.projectID;
    const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
    if (startMode === StartModes.debug || startMode === StartModes.debugNoInit) {
        portNumberChanged = await hasDebugPortChanged(projectInfo);
    }

    console.log("restarting with operation %j\n", operation);
    console.log("restarting with start mode %s\n", startMode);
    console.log("restarting with eventName %s\n", eventName);

    const cachedStartMode = projectInfo.startMode;
    // need to rebuild the container in oder to change the port
    if (portNumberChanged) {
        logger.logProjectInfo("Rebuilding the project due to debug port changed.", projectID);
        projectInfo.startMode = startMode;
            projectHandler.rebuild(projectInfo).then(async () => {
                await projectHandler.start(projectInfo);
                const keyValuePair: UpdateProjectInfoPair = {
                    key : "startMode",
                    value: startMode,
                    saveIntoJsonFile: true
                };
                projectsController.updateProjectInfo(projectID, keyValuePair);
                logger.logProjectInfo("Project start for restart was successful", projectID);
                const containerInfo: any = await getContainerInfo(projectInfo, true);
                const data: any = {
                    operationId: operation.operationId,
                    projectID: projectID,
                    status: "success",
                    startMode: startMode,
                    ports: {
                        exposedPort: containerInfo.exposedPort,
                        internalPort: containerInfo.internalPort
                    }
                };
                if (containerInfo.containerId) {
                    data.containerId = containerInfo.containerId;
                }
                if (containerInfo.exposedDebugPort) {
                    data.ports.exposedDebugPort = containerInfo.exposedDebugPort;
                }
                if (containerInfo.internalDebugPort) {
                    data.ports.internalDebugPort = containerInfo.internalDebugPort;
                }

                io.emitOnListener(eventName, data);
        }, (err: Error)  => {
            logger.logProjectError("Project rebuild failed with message: " + err.message, projectID);
            const data: any = {
                operationId: operation.operationId,
                projectID: projectID,
                status: "failed",
                errorMsg: err.message
            };
            if (eventName === "projectSettingsChanged") {
                data.name = "debugPort";
            }
            io.emitOnListener(eventName, data);
            // the only case the project restart failed. Startmode needs to be changed back
            projectInfo.startMode = cachedStartMode;
        });
    } else {
        // Try to stop the project. Emit a restart result failure if it fails.
        projectHandler.stop(projectInfo).then(() => {
            logger.logProjectInfo("Project stop for restart was successful", projectID);
        }, (err: Error) => {
            logger.logProjectError("Project stop for restart failed with message: " + err.message, projectID);
            const data: any = {
                operationId: operation.operationId,
                projectID: projectID,
                status: "failed",
                errorMsg: err.message
            };
            if (eventName === "projectSettingsChanged") {
                data.name = "debugPort";
            }
            io.emitOnListener(eventName, data);
        });

        // Once the project is stopped, request it to start, then emit a restart result success when it does.
        projectStatusController.waitForApplicationState(projectID, AppState.stopped, async (err: string, appState: AppState) => {
            try {
                projectInfo.startMode = startMode;
                await projectHandler.start(projectInfo);
                const keyValuePair: UpdateProjectInfoPair = {
                    key : "startMode",
                    value: startMode,
                    saveIntoJsonFile: true
                };
                projectsController.updateProjectInfo(projectID, keyValuePair);
                logger.logProjectInfo("Project start for restart was successful", projectID);
                const containerInfo: any = await getContainerInfo(projectInfo, true);
                const data: any = {
                    operationId: operation.operationId,
                    projectID: projectID,
                    status: "success",
                    startMode: startMode,
                    ports: {
                        exposedPort: containerInfo.exposedPort,
                        internalPort: containerInfo.internalPort
                    }
                };
                if (containerInfo.containerId) {
                    data.containerId = containerInfo.containerId;
                }
                if (containerInfo.exposedDebugPort) {
                    data.ports.exposedDebugPort = containerInfo.exposedDebugPort;
                }
                if (containerInfo.internalDebugPort) {
                    data.ports.internalDebugPort = containerInfo.internalDebugPort;
                }
                if (eventName === "projectSettingsChanged") {
                    data.name = "debugPort";
                }
                io.emitOnListener(eventName, data);
            } catch (err) {
                logger.logProjectError("Project start for restart failed with message: " + err.message, projectID);
                const data: any = {
                    operationId: operation.operationId,
                    projectID: projectID,
                    status: "failed",
                    errorMsg: err.message
                    // In this case, the startMode does not change
                };
                if (eventName === "projectSettingsChanged") {
                    data.name = "debugPort";
                }
                io.emitOnListener(eventName, data);
                // the only case the project restart failed. Startmode needs to be changed back
                projectInfo.startMode = cachedStartMode;
            }
        });
    }
}

/**
 * @function
 * @description Update detailed app status.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param ip <Required | String> - The project ip that Turbine pings.
 * @param port <Required | String> - The project port that Turbine pings.
 * @param path <Required | String> - The project path that Turbine pings.
 *
 * @returns Promise<void>
 */
export async function updateDetailedAppStatus(projectID: string, ip: string, port: string, path: string, isDefaultPath?: boolean): Promise<void> {
    const oldState = appStateMap.get(projectID).state;
    const oldMsg = appStateMap.get(projectID).msg;

    let pingPathEvent: DetailedAppStatus;

    if (isDefaultPath) {
        pingMessage = await locale.getTranslation("projectUtil.defaultPingPathMessage", { ip: ip, port: port, path: path });
    } else {
        pingMessage = await locale.getTranslation("projectUtil.pingMessage", { ip: ip, port: port, path: path });
    }

    pingPathEvent = {
        severity: "INFO",
        message: pingMessage,
        notify: false
    };

    if (oldState === AppState.starting) {
        projectStatusController.updateProjectStatus(STATE_TYPES.appState, projectID, AppState.starting, oldMsg, undefined, undefined, oldMsg, pingPathEvent);
    }
}
