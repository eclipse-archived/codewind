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
import { Operation } from "./operation";
import { ProjectInfo, BuildLog, AppLog, ProjectCapabilities, defaultProjectCapabilities } from "./Project";
import { Validator } from "./Validator";
import * as logHelper from "./logHelper";
import * as projectEventsController from "../controllers/projectEventsController";
import { IExtensionProject } from "../extensions/IExtensionProject";
import * as processManager from "../utils/processManager";
import * as logger from "../utils/logger";
import { projectConstants, StartModes } from "./constants";

/**
 * @interface
 * @description Interface for port mappings per language.
 */
interface PortMappings {
    [language: string]: string | string[];
}

/**
 * @interface
 * @description Interface for shell extension project configuration.
 */
interface ShellExtensionProjectConfig {
    requiredFiles: string[];
    buildContainerLogs?: logHelper.ILogOriginTypes;
    buildWorkspaceLogs?: logHelper.ILogOriginTypes;
    appContainerLogs?: logHelper.ILogOriginTypes;
    appWorkspaceLogs?: logHelper.ILogOriginTypes;
    appPort?: string[] | PortMappings; // string[] for backward compatibility
    debugPort?: PortMappings;
    capabilities?: ProjectCapabilities;
    container?: {
        prefix: string;
        suffix: string;
    };
}

// skeleton for the logs originated from the extension script
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
 * @class
 * @extends IExtensionProject
 * @description The class representing a shell-type handler for extension projects.  A shell handler
 * must contain a .sh-extension configuration file (of type ShellExtensionProjectConfig), and also
 * an entrypoint.sh shell script with operations to create/stop/validate/etc the project.
 */
export class ShellExtensionProject implements IExtensionProject {

    supportedType: string;
    detectChangeByExtension: boolean = true;

    private fullPath: string;
    private config: ShellExtensionProjectConfig;
    private language: string;

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
     * @description Set the language. Value may be adjusted by the entrypoint.sh script.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    private setLanguage = async (projectInfo: ProjectInfo): Promise<void> => {

        const logDir = await logHelper.getLogDir(
            projectInfo.projectID, path.basename(projectInfo.location));

        const args = [
            projectInfo.location,
            projectUtil.LOCAL_WORKSPACE,
            projectInfo.projectID,
            projectInfo.language,
            "",
            "",
            "",
            "",
            "",
            "",
            logDir
        ];

        try {
            const result = await processManager.spawnDetachedAsync(
                projectInfo.projectID,
                path.join(this.fullPath, "entrypoint.sh"),
                args,
                {});

            if (!result.stderr) {
                const json = await fs.readJson(
                    path.join(projectConstants.projectsLogDir, logDir, "settings.json"), { encoding: "utf8" });
                this.language = json.language;
                return;
            }
        }
        catch (err) {
            logger.logError(err.message);
        }

        this.language = projectInfo.language;
    }

    /**
     * @function
     * @description Initialize this extension project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    init = async (projectInfo: ProjectInfo): Promise<void> => {
        this.fullPath = projectInfo.extensionID;
        this.config = await fs.readJson(path.join(this.fullPath, ".sh-extension"));
        this.setLogsOriginFromExtension();
        await this.setLanguage(projectInfo);
    }

    /**
     * @function
     * @description Create operation for the project.
     *
     * @param operation <Required | Operation> - The create operation.
     */
    create = (operation: Operation): void => {
        projectUtil.containerCreate(operation, path.join(this.fullPath, "entrypoint.sh"), "create");
    }

    /**
     * @function
     * @description Update operation for the project.
     *
     * @param operation <Required | Operation> - The update operation.
     * @param changedFiles <Optional | projectEventsController.IFileChangeEvent[]> - The file changed event array.
     */
    update = (operation: Operation, changedFiles?: projectEventsController.IFileChangeEvent[]): void => {
        projectUtil.containerUpdate(operation, path.join(this.fullPath, "entrypoint.sh"), "update");
    }

    /**
     * @function
     * @description Start the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    start = async (projectInfo: ProjectInfo): Promise<void> => {
        await projectUtil.runScript(projectInfo, path.join(this.fullPath, "entrypoint.sh"), "start");
    }

    /**
     * @function
     * @description Stop the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    stop = async (projectInfo: ProjectInfo): Promise<void> => {
        await projectUtil.runScript(projectInfo, path.join(this.fullPath, "entrypoint.sh"), "stop");
    }

    /**
     * @function
     * @description Rebuild operation for the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    rebuild = async (projectInfo: ProjectInfo): Promise<void> => {
        await projectUtil.runScript(projectInfo, path.join(this.fullPath, "entrypoint.sh"), "rebuild");
    }

    /**
     * @function
     * @description Delete container for the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    deleteContainer = async (projectInfo: ProjectInfo): Promise<void> => {
        await projectUtil.containerDelete(projectInfo, path.join(this.fullPath, "entrypoint.sh"));
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
     * @description Get ports defined for language. If no ports are defined this function returns "undefined".
     * Otherwise it returns a single port value or an array of port values. This function never returns an empty array.
     *
     * @returns string | string[]
     */
    private getPorts = (map: PortMappings): string | string[] => {

        let ports: string | string[];

        if (map) {
            ports = map[this.language];
            // ensure we return undefined rather than empty array
            if (Array.isArray(ports) && ports.length == 0)
                return undefined;
        }

        return ports;
    }

    /**
     * @function
     * @description Get the all possible app port(s) for projects that this handler handles.
     *
     * @returns string | string[]
     */
    getDefaultAppPort = (): string | string[] => {

        // for backward compatibility
        if (Array.isArray(this.config.appPort))
            return this.config.appPort;

        return this.getPorts(this.config.appPort);
    }

    /**
     * @function
     * @description Get the default debug port of the project.
     *
     * @returns string
     */
    getDefaultDebugPort = (): string => {

        const ports = this.getPorts(this.config.debugPort);
        if (Array.isArray(ports))
            return ports[0];

        return ports;
    }

    /**
     * @function
     * @description Get the project capabilities of the project.
     *
     * @returns ProjectCapabilities
     */
    getCapabilities = (): ProjectCapabilities => {

        if (this.config.capabilities) {

            let startModes;

            if (this.getDefaultDebugPort())
                startModes = this.config.capabilities.startModes;
            // no debug port, filter out debug modes
            else {
                startModes = this.config.capabilities.startModes.filter((startMode) => {
                    return startMode != StartModes.debug && startMode != StartModes.debugNoInit;
                });
            }

            return new ProjectCapabilities(
                startModes, this.config.capabilities.controlCommands);
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
        const name = projectUtil.getDefaultContainerName(projectID, projectLocation);

        if (this.config.container) {
            const end = name.lastIndexOf(`-${projectID}`);
            // replace default prefix (cw-) and suffix (-projectID)
            return this.config.container.prefix + name.substring(3, end) + this.config.container.suffix;
        }

        return name;
    }

    /**
     * @function
     * @description Get the default ping timeout of an appsody project.
     *
     * @returns number
     */
    getDefaultPingTimeout(): number {
        return 90;
    }
}
