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
import * as path from "path";
import * as logger from "../utils/logger";
import * as projectUtil from "./projectUtil";
import * as utils from "../utils/utils";
import { Operation } from "./operation";
import { ProjectInfo, BuildLog, AppLog } from "./Project";
import { Validator } from "./Validator";
import * as logHelper from "./logHelper";
import * as projectEventsController from "../controllers/projectEventsController";

interface ProjectExtension {
    supportedType: string;
    create(operation: Operation): void;
    update(operation: Operation, changedFiles: projectEventsController.IFileChangeEvent[]): void;
    typeMatches(location: string): Promise<boolean>;
    getLogs(type: string, logDirectory: string, projectID: string, containerName: string): Promise<Array<AppLog | BuildLog>>;
    validate(operation: Operation): void;
}

export const requiredFiles = [ "/Dockerfile" ];

const logsOrigin: logHelper.ILogTypes = {
    "build": {
        "workspace": {
            "files": {
                [logHelper.buildLogs.dockerBuild]: undefined // set during runtime
            }
        }
    },
    "app": {
        "workspace": {
            "files": {
                [logHelper.appLogs.app]: undefined // set during runtime
            },
        }
    }
};

/**
 * @class
 * @extends ProjectExtension
 * @description The class representing docker projects.
 */
export class DockerProject implements ProjectExtension {

    supportedType: string;
    detectChangeByExtension: boolean = false;

    /**
     * @constructor
     * @description Constructor of DockerProject class extending ProjectExtension.
     *
     * @param type <Required | String> - Set the supported type.
     */
    constructor(type: string) {
        this.supportedType = type;
    }

    /**
     * @description Relative path from project's root directory
     *
     * For docker projects, watch entire project directory by default
     * .swp, swx, 4913 files are all temporary files created by vim & vi, need to ignore thoses files
     *
     */
    defaultIgnoredPath: string[] = ["/.project", "*/node_modules*", "*/.git/*", "*/.DS_Store", "*/*.swp", "*/*.swx", "*/4913", "/load-test*",
        "*/.dockerignore", "*/.gitignore", "*/*~", "/.settings"];

    /**
     * @function
     * @description Create operation for docker projects.
     *
     * @param operation <Required | Operation> - The create operation.
     *
     * @returns Promise<void>
     */
    async create(operation: Operation): Promise<void> {
        try {
            await projectUtil.buildAndRun(operation, "create");
        } catch (err) {
            logger.logProjectError("There was a problem building the project", operation.projectInfo.projectID);
            logger.logProjectError(err, operation.projectInfo.projectID);
        }
    }

    /**
     * @function
     * @description Update operation for docker projects.
     *
     * @param operation <Required | Operation> - The update operation.
     * @param changedFiles <Optional | projectEventsController.IFileChangeEvent[]> - The file changed event array.
     *
     * @returns Promise<void>
     */
    async update(operation: Operation, changedFiles?: projectEventsController.IFileChangeEvent[]): Promise<void> {
        try {
            await projectUtil.buildAndRun(operation, "update");
        } catch (err) {
            logger.logProjectError("There was a problem updating the project", operation.projectInfo.projectID);
            logger.logProjectError(err, operation.projectInfo.projectID);
        }
    }

    /**
     * @function
     * @description Delete container for the docker project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
     *
     * @returns Promise<void>
     */
    async deleteContainer(projectInfo: ProjectInfo): Promise<void> {
        try {
            await projectUtil.removeProject(projectInfo);
        } catch (err) {
            logger.logProjectError("There was a problem removing the project", projectInfo.projectID);
            logger.logProjectError(err, projectInfo.projectID);
        }
    }

    /**
     * @function
     * @description Check to see if the project in the given location is of type docker project.
     *
     * @param location <Required | String> - The folder location of the project.
     *
     * @returns Promise<boolean>
     */
    async typeMatches(location: string): Promise<boolean> {
        return await utils.asyncFileExists(`${location}/Dockerfile`);
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
    async getLogs(type: string, logDirectory: string, projectID: string, containerName: string): Promise<Array<AppLog | BuildLog>> {
        if (type.toLowerCase() != "build" && type.toLowerCase() != "app") return;
        return await logHelper.getLogs(type, logsOrigin, logDirectory, projectID, containerName);
    }

    /**
     * @function
     * @description Validate a docker project.
     *
     * @param operation <Required | Operation> - The validate operation for a docker project.
     *
     * @returns Promise<void>
     */
    async validate(operation: Operation): Promise<void> {
        const validator = new Validator(operation);
        await validator.validateRequiredFiles(requiredFiles);

        validator.sendResult();
    }

    /**
     * @function
     * @description Get the default ping timeout of a docker project.
     *
     * @returns number
     */
    getDefaultPingTimeout(): number {
        return 30;
    }
}
