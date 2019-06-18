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

import * as utils from "./utils";
import * as constants from "../projects/constants";
import * as logger from "./logger";
import * as processManager from "./processManager";
import * as io from "./socket";
import * as locale from "./locale";

export interface WorkspaceSettingsInfo {
    deploymentRegistry: string;
    watcherChunkTimeout: string;
}

export interface WorkspaceMetadata {
    workspaceSettingsFile: string;
}

export interface IWorkspaceSettingsSuccess {
    statusCode: 200;
    workspaceSettings: string;
}

export interface IWorkspaceSettingsFailure {
    statusCode: 400;
    error: { msg: string };
}

export let workspaceSettingsInfoCache: string = undefined;

/**
 * @see [[Filewatcher.readWorkspaceSettings]]
 */
export async function readWorkspaceSettings(): Promise<IWorkspaceSettingsSuccess | IWorkspaceSettingsFailure> {

    const workspaceSettingsFile = constants.workspaceConstants.workspaceSettingsFile;
    logger.logFileWatcherInfo("Reading the workspace settings file " + workspaceSettingsFile);
    let settingsFileContent: any;
    try {
        if (await utils.asyncFileExists(workspaceSettingsFile)) {
            settingsFileContent = await utils.asyncReadJSONFile(workspaceSettingsFile);
            logger.logFileWatcherInfo("Workspace settings file content: " + JSON.stringify(settingsFileContent));
        } else {
            const msg = "The workspace settings file was not found at location: " + workspaceSettingsFile;
            logger.logFileWatcherError(msg);
            return;
        }
    } catch (err) {
        const msg = "Codewind encountered an error when trying to read the workspace settings file";
        logger.logFileWatcherError(err);
        return { "statusCode": 400, "error": {"msg": msg}};
    }

    await loadWorkspaceSettings(settingsFileContent);

    return { "statusCode": 200, "workspaceSettings": JSON.stringify(settingsFileContent)};
}

/**
 * @function
 * @description Load the workspace settings into cache if present in the workspace settings file
 *
 *
 * @returns Promise<any>
 */
export async function loadWorkspaceSettings(workspaceSettings: any): Promise<any> {

    const workspaceSettingsInfo: WorkspaceSettingsInfo = {
        deploymentRegistry: workspaceSettings.deploymentRegistry ? workspaceSettings.deploymentRegistry : "",
        watcherChunkTimeout: workspaceSettings.watcherChunkTimeout ? workspaceSettings.watcherChunkTimeout : ""
    };

    logger.logFileWatcherInfo("Caching workspace settings: " + JSON.stringify(workspaceSettingsInfo));

    await cacheWorkspaceSettingsInfo(workspaceSettingsInfo);

    return;
}

/**
 * @function
 * @description Cache the project info to the file.
 *
 * @param workspaceSettings <Required | WorkspaceSettingsInfo> - The Workspace Settings Info read from the settings file.
 *
 * @returns void
 */
export async function cacheWorkspaceSettingsInfo(workspaceSettings: WorkspaceSettingsInfo): Promise<void> {
    return new Promise((resolve) => {
        const workspaceSettingsJSON = JSON.stringify(workspaceSettings);
        workspaceSettingsInfoCache = workspaceSettingsJSON;
        logger.logFileWatcherInfo("Cached Workspace Settings Info Cache: " + workspaceSettingsInfoCache);
        resolve();
    });
}

/**
 * @function
 * @description Get the workspace settings info from cache or the settings file.
 *
 * @returns Promise<any>
 */
export async function getWorkspaceSettingsInfo(): Promise<any> {
    const workspaceSettingsFile = constants.workspaceConstants.workspaceSettingsFile;
    if (workspaceSettingsInfoCache) {
        logger.logFileWatcherInfo("workspaceSettingsInfoCache cache: " + workspaceSettingsInfoCache);
        return JSON.parse(workspaceSettingsInfoCache);
    }

    let data: any;
    const emptyWorkspaceSettingsInfo: WorkspaceSettingsInfo = {
        deploymentRegistry: "",
        watcherChunkTimeout: ""
    };
    try {
        logger.logFileWatcherInfo("Unable to find the workspace settings cache, reading the workspace settings file: " + workspaceSettingsFile);
        if (await utils.asyncFileExists(workspaceSettingsFile)) {
            data = await utils.asyncReadJSONFile(workspaceSettingsFile);
            logger.logFileWatcherInfo("Returning workspace settings file content: " + JSON.stringify(data));
            return data;
        } else {
            const msg = "The workspace settings file was not found at location: " + workspaceSettingsFile;
            logger.logFileWatcherError(msg);
            // Since the workspace settings cache or the workspace settings file were not found, return an empty workspaceSettingsInfo
            return emptyWorkspaceSettingsInfo;
        }
    } catch (err) {
        logger.logFileWatcherError("Failed to find workspace settings information related to file " + workspaceSettingsFile);
        // Since the workspace settings cache or the workspace settings file were not found, return an empty workspaceSettingsInfo
        return emptyWorkspaceSettingsInfo;
    }
}

/**
 * @see [[Filewatcher.testDeploymentRegistry]]
 */
export async function testDeploymentRegistry(deploymentRegistry: string): Promise<IWorkspaceSettingsSuccess | IWorkspaceSettingsFailure> {

    let deploymentRegistryTest: boolean = false;

    logger.logFileWatcherInfo("Testing the deployment registry: " + deploymentRegistry);
    try {
        await processManager.spawnDetachedAsync("deploymentRegistryTest1", "docker", ["pull", "hello-world"], {});
        await processManager.spawnDetachedAsync("deploymentRegistryTest1", "docker", ["tag", "hello-world", deploymentRegistry + "/hello-world"], {});
    } catch (err) {
        const msg = "Codewind was unable to pull and tag an image during the Deployment Registry test.";
        logger.logFileWatcherError(msg);
        logger.logFileWatcherError(err);
        const deploymentRegistryTestJSON = {
            msg: msg
        };

        const data: any = {
            deploymentRegistryTest: deploymentRegistryTest,
            msg: msg
        };
        io.emitOnListener("deploymentRegistryTest", data);

        return { "statusCode": 400, "error": deploymentRegistryTestJSON};
    }

    let dockerPushOutput;

    try {
        dockerPushOutput = (await processManager.spawnDetachedAsync("deploymentRegistryTest1", "docker", ["push", deploymentRegistry + "/hello-world"], {})).stdout;
    } catch (err) {
        const msg = "Codewind was unable to push an image to the Deployment Registry. Please make sure it is a valid Deployment Registry with the appropriate permissions.";
        logger.logFileWatcherError(msg);
        logger.logFileWatcherError(err);
        const deploymentRegistryTestJSON = {
            msg: msg
        };

        const data: any = {
            deploymentRegistryTest: deploymentRegistryTest,
            msg: msg
        };
        io.emitOnListener("deploymentRegistryTest", data);

        return { "statusCode": 400, "error": deploymentRegistryTestJSON};
    }

    if (dockerPushOutput.includes("latest: digest:")) {
        deploymentRegistryTest = true;
    }

    logger.logFileWatcherInfo("Deployment Registry Test Status: " + deploymentRegistryTest);
    let msg;
    if (deploymentRegistryTest) {
        msg = "Codewind projects on Kubernetes will build with the Deployment Registry: " + deploymentRegistry;
        logger.logFileWatcherInfo("Successful Deployment Registry test");
        logger.logFileWatcherInfo(msg);
    } else {
        msg = "Codewind projects on Kubernetes cannot build with the Deployment Registry, as Codewind encountered an issue when pushing an image to: " + deploymentRegistry + ". Please make sure it is a valid Deployment Registry with the appropriate permissions.";
        logger.logFileWatcherInfo("Un-successful Deployment Registry test");
        logger.logFileWatcherInfo(msg);
    }

    const data: any = {
        deploymentRegistryTest: deploymentRegistryTest,
        msg: msg
    };

    io.emitOnListener("deploymentRegistryTest", data);

    const deploymentRegistryTestJSON = {
        deploymentRegistryTest: deploymentRegistryTest
    };

    return { "statusCode": 200, "workspaceSettings": JSON.stringify(deploymentRegistryTestJSON)};
}

/**
 * @see [[Filewatcher.deploymentRegistryStatus]]
 */
export async function deploymentRegistryStatus(req: IDeploymentRegistryStatusParams): Promise<IDeploymentRegistryStatusSuccess | IDeploymentRegistryStatusFailure> {

    if (!req.projectID || !req.detailedDeploymentRegistryStatus) {
        return { "statusCode": 400, "error": { "msg": "Missing request parameters projectID or detailedDeploymentRegistryStatus for deployment registry status"}};
    }

    const projectID: string = req.projectID;
    const msg: string = req.detailedDeploymentRegistryStatus;

    await updateDeploymentRegistryStatus(projectID, msg);

    return { "statusCode": 200};
}

/**
 * @function
 * @description Update the status for a deployment registry. This function will only be called if Codewind detects an invalid deployment registry.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param msg <Required | String> - The new message to emit.
 *
 * @returns Promise<void>
 */
export async function updateDeploymentRegistryStatus(projectID: string, msg: string): Promise<void> {

    logger.logProjectInfo("Updating the Deployment Registry Status", projectID);

    const deploymentRegistryTest: boolean = false;

    const translatedMessage = await locale.getTranslation(msg);

    const data: any = {
        deploymentRegistryTest: deploymentRegistryTest,
        msg: translatedMessage
    };

    logger.logProjectInfo("Deployment Registry Status Message: " + translatedMessage, projectID);
    logger.logProjectInfo("Deployment Registry Status: " + JSON.stringify(data), projectID);

    io.emitOnListener("deploymentRegistryTest", data);
}

export interface IDeploymentRegistryStatusParams {
    projectID: string;
    detailedDeploymentRegistryStatus: string;
}

export interface IDeploymentRegistryStatusSuccess {
    statusCode: 200;
}

export interface IDeploymentRegistryStatusFailure {
    statusCode: 400 | 404;
    error: { msg: string };
}