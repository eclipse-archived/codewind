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

import fs from "fs-extra";
import * as path from "path";

import * as projectUtil from "./projectUtil";
import * as processManager from "../utils/processManager";
import * as logHelper from "./logHelper";
import * as projectEventsController from "../controllers/projectEventsController";
import * as logger from "../utils/logger";
import { Operation } from "./operation";
import { ProjectInfo, BuildLog, AppLog, ProjectCapabilities, defaultProjectCapabilities } from "./Project";
import { Validator } from "./Validator";
import { IExtensionProject } from "../extensions/IExtensionProject";

// skeleton for the logs originated from the extension json
const logsOrigin: logHelper.ILogTypes = {
    "build": {
        "container": {
            "files": {},
            "dirs": {}
        },
        "workspace": {
            "files": {},
            "dirs": {}
        },
    },
    "app": {
        "container": {
            "files": {},
            "dirs": {}
        },
        "workspace": {
            "files": {},
            "dirs": {}
        },
    },
};

/**
 * @interface
 * @description Interface for odo extension project configuration.
 */
interface OdoExtensionProjectConfig {
    requiredFiles: string[];
    buildContainerLogs?: logHelper.ILogOriginTypes;
    buildWorkspaceLogs?: logHelper.ILogOriginTypes;
    appContainerLogs?: logHelper.ILogOriginTypes;
    appWorkspaceLogs?: logHelper.ILogOriginTypes;
    capabilities?: ProjectCapabilities;
}

/**
 * @class
 * @extends IExtensionProject
 * @description The class representing a project handler for odo extension projects. It is
 * used for storing odo extension metadata and calling odo extension operations (eg. create, update, remove, etc).
 */
export class OdoExtensionProject implements IExtensionProject {

    supportedType: string;
    detectChangeByExtension: boolean = false;

    private fullPath: string;
    private config: OdoExtensionProjectConfig;

    /**
     * @constructor
     * @description Constructor.
     *
     * @param type <Required | String> - Set the supported type.
     */
    constructor(type: string) {
        this.supportedType = type;
    }

    /**
     * @function
     * @description Initialize this extension project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    init = async (projectInfo: ProjectInfo): Promise<void> => {
        this.fullPath = projectInfo.extensionID;
        this.config = await fs.readJson(path.join(this.fullPath, ".odo-extension-config.json"));
        this.setLogsOriginFromExtension();
    }

    /**
     * @function
     * @description Create operation for the project.
     *
     * @param operation <Required | Operation> - The create operation.
     */
    create = (operation: Operation): void => {
        projectUtil.containerCreate(operation, path.join(this.fullPath, "odo-extension-entrypoint.sh"), "create");
    }

    /**
     * @function
     * @description Update operation for the project.
     *
     * @param operation <Required | Operation> - The update operation.
     * @param changedFiles <Optional | projectEventsController.IFileChangeEvent[]> - The file changed event array.
     */
    update = (operation: Operation, changedFiles?: projectEventsController.IFileChangeEvent[]): void => {
        projectUtil.containerUpdate(operation, path.join(this.fullPath, "odo-extension-entrypoint.sh"), "update");
    }

    /**
     * @function
     * @description Rebuild operation for the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    rebuild = async (projectInfo: ProjectInfo): Promise<void> => {
        await projectUtil.runScript(projectInfo, path.join(this.fullPath, "odo-extension-entrypoint.sh"), "rebuild");
    }

    /**
     * @function
     * @description Delete operation for the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    deleteContainer = async (projectInfo: ProjectInfo): Promise<void> => {
        await projectUtil.containerDelete(projectInfo, path.join(this.fullPath, "odo-extension-entrypoint.sh"));
    }

    /**
     * @function
     * @description Validate project.
     *
     * @param operation <Required | Operation> - The validate operation for the project.
     */
    validate = async (operation: Operation): Promise<void> => {
        const validator = new Validator(operation);
        await validator.validateRequiredFiles(this.config.requiredFiles);
        validator.sendResult();
    }

    /**
     * @function
     * @description Get logs from files or directories.
     *
     * @param type <Required | String> - The type of log ("build" or "app")
     * @param logDirectory <Required | String> - The log location directory.
     * @param projectID <Required | String> - An alphanumeric identifier for a project.
     * @param containerName <Required | String> - The docker container name.
     *
     * @returns Promise<Array<AppLog | BuildLog>>
     */
    getLogs = async (type: string, logDirectory: string, projectID: string, containerName: string): Promise<Array<AppLog | BuildLog>> => {
        if (type.toLowerCase() != "build" && type.toLowerCase() != "app") return;
        return await logHelper.getLogs(type, logsOrigin, logDirectory, projectID, containerName);
    }

    setLogsOriginFromExtension(): void {
        if (this.config.buildContainerLogs && (this.config.buildContainerLogs.files || this.config.buildContainerLogs.dirs)) {
            logsOrigin.build.container = this.config.buildContainerLogs;
        }
        if (this.config.buildWorkspaceLogs && (this.config.buildWorkspaceLogs.files || this.config.buildWorkspaceLogs.dirs)) {
            logsOrigin.build.workspace = this.config.buildWorkspaceLogs;
        }

        if (this.config.appContainerLogs && (this.config.appContainerLogs.files || this.config.appContainerLogs.dirs)) {
            logsOrigin.app.container = this.config.appContainerLogs;
        }
        if (this.config.appWorkspaceLogs && (this.config.appWorkspaceLogs.files || this.config.appWorkspaceLogs.dirs)) {
            logsOrigin.app.workspace = this.config.appWorkspaceLogs;
        }
    }

    /**
     * @function
     * @description Get the project capabilities of the project.
     *
     * @returns ProjectCapabilities
     */
    getCapabilities = (): ProjectCapabilities => {

        if (this.config.capabilities) {
            return new ProjectCapabilities(this.config.capabilities.startModes, this.config.capabilities.controlCommands);
        }

        return defaultProjectCapabilities;
    }

    /**
     * @function
     * @description Return a reproducible container name for the project.
     *
     * @param projectID <Required | string> - An alphanumeric identifier for a project.
     * @param projectLocation <Required | string> - The project location directory.
     *
     * @returns Promise<string>
     */
    getContainerName = async (projectID: string, projectLocation: string): Promise<string> => {
        let podName: string = undefined;
        const projectName: string = path.basename(projectLocation);
        const componentName: string = await projectUtil.getComponentName(projectName);
        const args: string[] = [
            projectLocation,
            "",
            "getPodName",
            "",
            componentName,
            "",
            ""
        ];

        try {
            const result = await processManager.spawnDetachedAsync(projectID, path.join(this.fullPath, "odo-extension-entrypoint.sh"), args, {});

            if (result.exitCode != 0) {
                logger.logProjectError(result.stderr, projectID, projectName);
            } else {
                podName = path.basename(result.stdout);
            }
        } catch (err) {
            logger.logProjectError(err, projectID, projectName);
        }

        return podName;
    }

    /**
     * @function
     * @description Return a reproducible app name for the project.
     *
     * @param projectID <Required | string> - An alphanumeric identifier for a project.
     *
     * @returns Promise<string>
     */
    getAppName = async (projectID: string): Promise<string> => {
        let appName: string = undefined;
        const projectInfo: ProjectInfo = await projectUtil.getProjectInfo(projectID);
        const projectLocation = projectInfo.location;
        const projectName = path.basename(projectLocation);
        const args: string[] = [
            projectLocation,
            "",
            "getAppName",
            "",
            "",
            "",
            ""
        ];

        try {
            const result = await processManager.spawnDetachedAsync(projectID, path.join(this.fullPath, "odo-extension-entrypoint.sh"), args, {});

            if (result.exitCode != 0) {
                logger.logProjectError(result.stderr, projectID, projectName);
            } else {
                appName = result.stdout;
            }
        } catch (err) {
            logger.logProjectError(err, projectID, projectName);
        }

        return appName;
    }

    /**
     * @function
     * @description Get the internal app port that the project uses.
     *
     * @param projectID <Required | string> - An alphanumeric identifier for a project.
     *
     * @returns Promise<string>
     */
    getAppPort = async (projectID: string): Promise<string> => {
        let appPort: string = undefined;
        const projectInfo: ProjectInfo = await projectUtil.getProjectInfo(projectID);
        const projectLocation = projectInfo.location;
        const projectName = path.basename(projectLocation);
        const args: string[] = [
            projectLocation,
            "",
            "getPort",
            "",
            "",
            "",
            ""
        ];

        try {
            const result = await processManager.spawnDetachedAsync(projectID, path.join(this.fullPath, "odo-extension-entrypoint.sh"), args, {});

            if (result.exitCode != 0) {
                logger.logProjectError(result.stderr, projectID, projectName);
            } else {
                appPort = result.stdout;
            }
        } catch (err) {
            logger.logProjectError(err, projectID, projectName);
        }

        return appPort;
    }

    /**
     * @function
     * @description Get the app ingress URL as app base URL.
     *
     * @param projectID <Required | string> - An alphanumeric identifier for a project.
     *
     * @returns Promise<string>
     */
    getAppBaseURL = async (projectID: string): Promise<string> => {
        let appBaseURL: string = undefined;
        const projectInfo: ProjectInfo = await projectUtil.getProjectInfo(projectID);
        const projectLocation = projectInfo.location;
        const projectName = path.basename(projectLocation);
        const args: string[] = [
            projectLocation,
            "",
            "getURL",
            "",
            "",
            "",
            ""
        ];

        try {
            const result = await processManager.spawnDetachedAsync(projectID, path.join(this.fullPath, "odo-extension-entrypoint.sh"), args, {});

            if (result.exitCode != 0) {
                logger.logProjectError(result.stderr, projectID, projectName);
            } else {
                appBaseURL = result.stdout;
            }
        } catch (err) {
            logger.logProjectError(err, projectID, projectName);
        }

        return appBaseURL;
    }

    /**
     * @function
     * @description Get the default ping timeout of an odo project.
     *
     * @returns number
     */
    getDefaultPingTimeout(): number {
        return 30;
    }
}
