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
    registryAddress: string;
    registryNamespace: string;
    watcherChunkTimeout: string;
}

export interface WorkspaceMetadata {
    workspaceSettingsFile: string;
}

export interface IWorkspaceSettingsSuccess {
    statusCode: 200;
}

export interface IWorkspaceSettingsFailure {
    statusCode: 400 | 500;
    msg: string;
}

export interface IImagePushRegistryTestSuccess {
    statusCode: 200;
    imagePushRegistryTest: boolean;
    msg: string;
}

export interface IImagePushRegistryTestFailure {
    statusCode: 400 | 500;
    imagePushRegistryTest: boolean;
    msg: string;
}

export let workspaceSettingsInfoCache: string = undefined;

/**
 * @see [[Filewatcher.readWorkspaceSettings]]
 */
export async function readWorkspaceSettings(): Promise<IWorkspaceSettingsSuccess | IWorkspaceSettingsFailure> {

    const workspaceSettingsFile = constants.workspaceConstants.workspaceSettingsFile;
    logger.logInfo("Reading the workspace settings file " + workspaceSettingsFile);
    let settingsFileContent: any;
    try {
        if (await utils.asyncFileExists(workspaceSettingsFile)) {
            settingsFileContent = await utils.asyncReadJSONFile(workspaceSettingsFile);
            logger.logInfo("Workspace settings file content: " + JSON.stringify(settingsFileContent));
        } else {
            const msg = "The workspace settings file was not found at location: " + workspaceSettingsFile;
            logger.logError(msg);
            return { "statusCode": 500, "msg": msg};
        }
    } catch (err) {
        const msg = "Codewind encountered an error when trying to read the workspace settings file";
        logger.logError(err);
        return { "statusCode": 500, "msg": msg};
    }

    // Do validation check on the Image Push Registry
    const imagePushRegistry = settingsFileContent.registryAddress + "/" + settingsFileContent.registryNamespace;
    // eslint-disable-next-line no-useless-escape
    const regex = new RegExp(/^[A-Za-z0-9-._~:\/?#\[\]@!\$&'\(\)\*\+;%=,]+$/);
    if (imagePushRegistry && imagePushRegistry.length) {
        const isImagePushRegistryValid = regex.test(imagePushRegistry);
        logger.logInfo("Image Push Registry Validation: " + isImagePushRegistryValid);
        if (!isImagePushRegistryValid) {
            const msg = "Codewind detected an error with the Image Push Registry " + imagePushRegistry + ". Please ensure it is a valid Image Push Registry.";
            logger.logError(msg);
            const data: any = {
                imagePushRegistryTest: false,
                msg: msg
            };
            io.emitOnListener("imagePushRegistryStatus", data);
            return { "statusCode": 500, "msg": msg };
        }
    }

    await loadWorkspaceSettings(settingsFileContent);

   return { "statusCode": 200 };
}

export async function writeWorkspaceSettings(address: string, namespace: string): Promise<IWorkspaceSettingsSuccess | IWorkspaceSettingsFailure> {
    const newWorkspaceSettings: any = {
        registryAddress: address,
        registryNamespace: namespace
    };
    logger.logInfo("Writing new workspace settings: " + JSON.stringify(newWorkspaceSettings));
    const workspaceSettingsFile = constants.workspaceConstants.workspaceSettingsFile;
    const workspaceSettingsInfo = await getWorkspaceSettingsInfo();
    for (const setting in newWorkspaceSettings) {
        workspaceSettingsInfo[setting] = newWorkspaceSettings[setting];
    }
    // Write the new settings, invalidate the cache and reload the cache since we no longer have file watch on the workspace settings file
    const writeStatus = await utils.asyncWriteJSONFile(workspaceSettingsFile, workspaceSettingsInfo);
    workspaceSettingsInfoCache = undefined;
    await readWorkspaceSettings();

    if (writeStatus) {
        return { "statusCode": 200 };
    } else {
        const msg = "Codewind encountered an error when trying to write the workspace settings file";
        return { statusCode: 500 , msg };
    }
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
        registryAddress: workspaceSettings.registryAddress ? workspaceSettings.registryAddress : "",
        registryNamespace: workspaceSettings.registryNamespace ? workspaceSettings.registryNamespace : "",
        watcherChunkTimeout: workspaceSettings.watcherChunkTimeout ? workspaceSettings.watcherChunkTimeout : ""
    };

    logger.logInfo("Caching workspace settings: " + JSON.stringify(workspaceSettingsInfo));

    return await cacheWorkspaceSettingsInfo(workspaceSettingsInfo);
}

/**
 * @function
 * @description Cache the project info to the file.
 *
 * @param workspaceSettings <Required | WorkspaceSettingsInfo> - The Workspace Settings Info read from the settings file.
 *
 * @returns void
 */
export async function cacheWorkspaceSettingsInfo(workspaceSettings: WorkspaceSettingsInfo): Promise<string> {
    return new Promise((resolve) => {
        workspaceSettingsInfoCache = JSON.stringify(workspaceSettings);
        logger.logInfo("Cached Workspace Settings Info Cache: " + workspaceSettingsInfoCache);
        resolve(workspaceSettingsInfoCache);
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
        logger.logInfo("workspaceSettingsInfoCache cache: " + workspaceSettingsInfoCache);
        const workspaceSettingsInfoCacheJSON = JSON.parse(workspaceSettingsInfoCache);
        return workspaceSettingsInfoCacheJSON;
    }

    let data: any;
    const emptyWorkspaceSettingsInfo: WorkspaceSettingsInfo = {
        registryAddress: "",
        registryNamespace: "",
        watcherChunkTimeout: ""
    };
    try {
        logger.logInfo("Unable to find the workspace settings cache, reading the workspace settings file: " + workspaceSettingsFile);
        if (await utils.asyncFileExists(workspaceSettingsFile)) {
            data = await utils.asyncReadJSONFile(workspaceSettingsFile);
            logger.logInfo("Returning workspace settings file content: " + JSON.stringify(data));
            return data;
        } else {
            const msg = "The workspace settings file was not found at location: " + workspaceSettingsFile;
            logger.logError(msg);
            // Since the workspace settings cache or the workspace settings file were not found, return an empty workspaceSettingsInfo
            return emptyWorkspaceSettingsInfo;
        }
    } catch (err) {
        logger.logError("Failed to find workspace settings information related to file " + workspaceSettingsFile);
        // Since the workspace settings cache or the workspace settings file were not found, return an empty workspaceSettingsInfo
        return emptyWorkspaceSettingsInfo;
    }
}

/**
 * @function
 * @description Transform the Image Push Registry Address to handle index.docker.io/v1 to docker.io conversion. This is done because
 * Codewind IDE UI has a single address field for both docker config and image push registry. If a user enters https://index.docker.io/v1/
 * the image push registry is not going to work because buildah wont be able to push to https://index.docker.io/v1/. It needs to be in the
 * format docker.io/<namespace>
 *
 * @param workspaceSettings <Required | any> - The workspace settings JSON object
 *
 * @returns Promise<any> - The updated workspace settings JSON object
 */
function transformImagePushRegistryAddress(address: string): string {

    if (address.includes("index.docker.io/v1")) {
        address = "docker.io";
    }

    // remove any trailing / and whitespace
    address = address.replace(/\/\s*$/, "");

    return address;
}

/**
 * @function
 * @description Read the workspace settings info, and return the image push registry
 *
 *
 * @returns Promise<string>
 */
export async function getImagePushRegistry(): Promise<string> {
    const workspaceSettingsInfo = await getWorkspaceSettingsInfo();
    try {
        // getImagePushRegistry() is called by projectUtil before project operations to push to registry, so transform the address
        workspaceSettingsInfo.registryAddress = transformImagePushRegistryAddress(workspaceSettingsInfo.registryAddress);
    } catch (err) {
        logger.logError(err);
        // return empty string if there is an error when transforming address. And project create/update will error out for invalid registry
        return "";
    }
    logger.logInfo("WorkspaceSettingsInfo for project operations: " + JSON.stringify(workspaceSettingsInfo));
    let imagePushRegistry = workspaceSettingsInfo.registryAddress.trim();

    // Only append if user entered a namespace
    if (workspaceSettingsInfo.registryNamespace.length > 0) {
        imagePushRegistry = imagePushRegistry + "/" + workspaceSettingsInfo.registryNamespace.trim();
    }

    return imagePushRegistry;
}

/**
 * @see [[Filewatcher.testImagePushRegistry]]
 */
export async function testImagePushRegistry(address: string, namespace: string, pullImage?: string): Promise<IImagePushRegistryTestSuccess | IImagePushRegistryTestFailure> {

    let imagePushRegistryTest: boolean = false;
    pullImage = pullImage || "hello-world";

    // always validate the image push registry address during test for conversion of index.docker.io/v1 to docker.io
    address = transformImagePushRegistryAddress(address);
    const imagePushRegistry = address + "/" + namespace;
    logger.logDebug("Image Push registry address: " + address);
    logger.logDebug("Image Push registry namespace: " + namespace);
    logger.logInfo("Testing the Image Push Registry: " + imagePushRegistry);
    try {
        await processManager.spawnDetachedAsync("imagePushRegistryTest1", "buildah", ["pull", pullImage], {});
    } catch (err) {
        const msg = `Codewind was unable to pull the ${pullImage} image during the Image Push Registry test.`;
        logger.logError(msg);
        logger.logError(err);

        const data: any = {
            imagePushRegistryTest: imagePushRegistryTest,
            msg: msg
        };
        io.emitOnListener("imagePushRegistryStatus", data);

        return { "statusCode": 500, "imagePushRegistryTest": imagePushRegistryTest, "msg": msg};
    }

    let buildahPushEC = 1;
    let buildahPush;

    try {
        buildahPush = (await processManager.spawnDetachedAsync("imagePushRegistryTest1", "buildah", ["push", "--tls-verify=false", pullImage, `${imagePushRegistry}/${pullImage}`], {}));
        buildahPushEC = buildahPush.exitCode;
        logger.logDebug("testImagePushRegistry exit code: " + buildahPushEC);
    } catch (err) {
        const msg = `Codewind was unable to push the ${pullImage} image to the Image Push Registry ${imagePushRegistry}/${pullImage}. Please make sure it is a valid Image Push Registry with the appropriate permissions.`;
        logger.logError(msg);
        logger.logError(err);

        const data: any = {
            imagePushRegistryTest: imagePushRegistryTest,
            msg: msg
        };
        io.emitOnListener("imagePushRegistryStatus", data);

        return { "statusCode": 200, "imagePushRegistryTest": imagePushRegistryTest, "msg": msg};
    }

    if (buildahPushEC == 0) {
        imagePushRegistryTest = true;
    }

    logger.logInfo("Image Push RegistryTest Test Status: " + imagePushRegistryTest);
    let msg;
    if (imagePushRegistryTest) {
        msg = "Codewind projects on Kubernetes will build with the Image Push Registry: " + imagePushRegistry;
        logger.logInfo("Successful Image Push Registry test");
        logger.logInfo(msg);
    } else {
        msg = "Codewind cannot build projects with the current Image Push Registry. The image could not be pushed to: " + imagePushRegistry + ". Please make sure it is a valid Image Push Registry with the appropriate permissions.";
        logger.logError("Un-successful Image Push Registry test");
        logger.logError(msg);
    }

    const data: any = {
        imagePushRegistryTest: imagePushRegistryTest,
        msg: msg
    };

    io.emitOnListener("imagePushRegistryStatus", data);

    return { "statusCode": 200, "imagePushRegistryTest": imagePushRegistryTest, "msg": msg};
}

/**
 * @see [[Filewatcher.imagePushRegistryStatus]]
 */
export async function imagePushRegistryStatus(req: IImagePushRegistryStatusParams): Promise<IImagePushRegistryStatusSuccess | IImagePushRegistryStatusFailure> {

    if (!req.projectID || !req.detailedImagePushRegistryStatus) {
        return { "statusCode": 400, "error": { "msg": "Missing request parameters projectID or detailedImagePushRegistryStatus for image push registry status"}};
    }

    const projectID: string = req.projectID;
    const msg: string = req.detailedImagePushRegistryStatus;

    await updateImagePushRegistryStatus(projectID, msg);

    return { "statusCode": 200};
}

/**
 * @function
 * @description Update the status for an image push registry. This function will only be called if Codewind detects an invalid image push registry.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param msg <Required | String> - The new message to emit.
 *
 * @returns Promise<void>
 */
export async function updateImagePushRegistryStatus(projectID: string, msg: string): Promise<void> {

    logger.logProjectInfo("Updating the Image Push Registry Status", projectID);

    const translatedMessage = await locale.getTranslation(msg);

    const data: any = {
        imagePushRegistryTest: false,
        msg: translatedMessage
    };

    logger.logProjectInfo("Image Push Registry Status Message: " + translatedMessage, projectID);
    logger.logProjectInfo("Image Push Registry Status: " + JSON.stringify(data), projectID);

    io.emitOnListener("imagePushRegistryStatus", data);
}

export interface IImagePushRegistryStatusParams {
    projectID: string;
    detailedImagePushRegistryStatus: string;
}

export interface IImagePushRegistryStatusSuccess {
    statusCode: 200;
}

export interface IImagePushRegistryStatusFailure {
    statusCode: 400 | 404;
    error: { msg: string };
}