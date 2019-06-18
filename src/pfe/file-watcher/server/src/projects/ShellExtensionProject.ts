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

import * as projectUtil from "./projectUtil";
import { Operation } from "./operation";
import { ProjectInfo, BuildLog, AppLog, ProjectCapabilities, defaultProjectCapabilities } from "./Project";
import { Validator } from "./Validator";
import * as logHelper from "./logHelper";
import * as projectEventsController from "../controllers/projectEventsController";
import { IExtensionProject } from "../extensions/IExtensionProject";

/**
 * @interface
 * @description Interface for shell extension project configuration.
 */
interface ShellExtensionProjectConfig {
    requiredFiles: string[];
    buildLogs: string[];
    appLogs: string[];
    appPort?: string | string[];
    debugPort?: string;
    capabilities?: ProjectCapabilities;
    container?: {
        prefix: string;
        suffix: string;
    };
}

/**
 * @class
 * @extends IExtensionProject
 * @description The class representing a shell-type handler for extension projects.  A shell handler
 * must contain a .sh-extension configuration file (of type ShellExtensionProjectConfig), and also
 * an entrypoint.sh shell script with operations to create/stop/validate/etc the project.
 */
export class ShellExtensionProject implements IExtensionProject {

    supportedType: string;

    private id: string;
    private config: ShellExtensionProjectConfig;

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
     * @param id <Required | string> - The extension id.
     */
    init = async (id: string): Promise<void> => {
        this.id = id;
        this.config = await fs.readJson(`/codewind-workspace/.extensions/${this.id}/.sh-extension`);
    }

    /**
     * @function
     * @description Create operation for the project.
     *
     * @param operation <Required | Operation> - The create operation.
     */
    create = (operation: Operation): void => {
        projectUtil.containerCreate(operation, `/codewind-workspace/.extensions/${this.id}/entrypoint.sh`, "create");
    }

    /**
     * @function
     * @description Update operation for the project.
     *
     * @param operation <Required | Operation> - The update operation.
     * @param changedFiles <Optional | projectEventsController.IFileChangeEvent[]> - The file changed event array.
     */
    update = (operation: Operation, changedFiles?: projectEventsController.IFileChangeEvent[]): void => {
        projectUtil.containerUpdate(operation, `/codewind-workspace/.extensions/${this.id}/entrypoint.sh`, "update");
    }

    /**
     * @function
     * @description Start the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    start = async (projectInfo: ProjectInfo): Promise<void> => {
        await projectUtil.runScript(projectInfo, `/codewind-workspace/.extensions/${this.id}/entrypoint.sh`, "start");
    }

    /**
     * @function
     * @description Stop the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    stop = async (projectInfo: ProjectInfo): Promise<void> => {
        await projectUtil.runScript(projectInfo, `/codewind-workspace/.extensions/${this.id}/entrypoint.sh`, "stop");
    }

    /**
     * @function
     * @description Rebuild operation for the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    rebuild = async (projectInfo: ProjectInfo): Promise<void> => {
        await projectUtil.runScript(projectInfo, `/codewind-workspace/.extensions/${this.id}/entrypoint.sh`, "rebuild");
    }

    /**
     * @function
     * @description Delete container for the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    deleteContainer = async (projectInfo: ProjectInfo): Promise<void> => {
        await projectUtil.containerDelete(projectInfo, `/codewind-workspace/.extensions/${this.id}/entrypoint.sh`);
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
     * @description Get the build log for the project.
     *
     * @param logDirectory <Required | string> - The log location directory.
     *
     * @returns Promise<BuildLog>
     */
    getBuildLog = async (logDirectory: string): Promise<BuildLog> => {
        return await logHelper.getBuildLogs(logDirectory, this.config.buildLogs);
    }

    /**
     * @function
     * @description Get the app log for the project.
     *
     * @param logDirectory <Required | String> - The log location directory.
     *
     * @returns Promise<AppLog>
     */
    getAppLog = async (logDirectory: string): Promise<AppLog> => {
        return await logHelper.getAppLogs(logDirectory, this.config.appLogs);
    }

    /**
     * @function
     * @description Get the all possible app port(s) for projects that this handler handles.
     *
     * @returns string | string[]
     */
    getDefaultAppPort = (): string | string[] => {
        return this.config.appPort;
    }

    /**
     * @function
     * @description Get the default debug port of the project.
     *
     * @returns string
     */
    getDefaultDebugPort = (): string => {
        return this.config.debugPort;
    }

    /**
     * @function
     * @description Get the project capabilities of the project.
     *
     * @returns ProjectCapabilities
     */
    getCapabilities = (): ProjectCapabilities => {

        if (this.config.capabilities) {
            return new ProjectCapabilities(
                this.config.capabilities.startModes, this.config.capabilities.controlCommands);
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
     * @returns string
     */
    getContainerName = (projectID: string, projectLocation: string): string => {

        const name = projectUtil.getDefaultContainerName(projectID, projectLocation);

        if (this.config.container) {
            const end = name.lastIndexOf(`-${projectID}`);
            // replace default prefix (cw-) and suffix (-projectID)
            return this.config.container.prefix + name.substring(3, end) + this.config.container.suffix;
        }

        return name;
    }
}
