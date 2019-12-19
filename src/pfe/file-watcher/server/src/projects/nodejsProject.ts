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
import * as projectUtil from "./projectUtil";
import * as processManager from "../utils/processManager";
import * as utils from "../utils/utils";
import { Validator } from "./Validator";
import { Operation } from "./operation";
import { ProjectInfo, BuildLog, AppLog } from "./Project";
import { ContainerStates } from "./constants";
import { ProjectCapabilities, defaultProjectCapabilities } from  "./Project";
import { StartModes, ControlCommands } from "./constants";
import * as logHelper from "./logHelper";
import * as projectEventsController from "../controllers/projectEventsController";

export const requiredFiles = [ "/Dockerfile", "/package.json"];
const capabilities = new ProjectCapabilities([StartModes.run, StartModes.debugNoInit], [ControlCommands.restart]);

export const supportedType = "nodejs";
export const detectChangeByExtension: boolean = false;

const logsOrigin: logHelper.ILogTypes = {
    "build": {
        "workspace": {
            "files": {
                [logHelper.buildLogs.dockerBuild]: undefined
            }
        }
    },
    "app": {
        "workspace": {
            "files": {
                [logHelper.appLogs.app]: undefined
            },
        }
    }
};

/**
 * @description Relative path from project's root directory
 *
 * nodejs project directory contains:
 * Dockerfile		chart			node_modules		package-lock.json	run-dev
 * Dockerfile-tools	cli-config.yml		nodejs_dc.log		package.json		server
 * Jenkinsfile		idt.js			nodejs_restclient.log	public			test
 * README.md		manifest.yml		nodemon.json		run-debug       .bluemix
 * .cfignore        .dockerignore       .gitignore          .cw-settings
 *
 * only want to watch ["/server", "/test", "/public", "/Dockerfile", "/Dockerfile-tools", "/package.json", "/nodemon.json", "/.cw-settings"], and "/chart" if on cloud
 * .swp, swx, 4913 files are all temporary files created by vim & vi, need to ignore thoses files
 *
 */
export const defaultIgnoredPath: string[] = ["/.project", "/run-dev", "/run-debug", "/package-lock.json*", "/nodejs_restclient.log", "/nodejs_dc.log",
                                             "/manifest.yml", "/idt.js", "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.cfignore", "/load-test*",
                                             "*/node_modules*", "*/.git/*", "*/.DS_Store", "*/*.swp", "*/*.swx", "*/4913", "*/.dockerignore", "*/.gitignore",
                                             "*/*~", "/.settings"];
if (!process.env.IN_K8) {
    defaultIgnoredPath.push("/chart");
}

/**
 * @function
 * @description Create operation for a nodejs project.
 *
 * @param operation <Required | Operation> - The create operation.
 *
 * @returns void
 */
export function create(operation: Operation): void {
    projectUtil.containerCreate(operation, "/file-watcher/scripts/nodejs-container.sh", "create");
}

/**
 * @function
 * @description Update operation for a nodejs project.
 *
 * @param operation <Required | Operation> - The update operation.
 * @param changedFiles <Optional | projectEventsController.IFileChangeEvent[]> - The file changed event array.
 *
 * @returns void
 */
export function update(operation: Operation, changedFiles?: projectEventsController.IFileChangeEvent[]): void {
    projectUtil.containerUpdate(operation, "/file-watcher/scripts/nodejs-container.sh", "update");
}

/**
 * @function
 * @description Delete the container for a nodejs project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function deleteContainer(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.containerDelete(projectInfo, "/file-watcher/scripts/nodejs-container.sh");
}

/**
 * @function
 * @description Check to see if the project in the given location is of type nodejs project.
 *
 * @param location <Required | String> - The folder location of the project.
 *
 * @returns Promise<boolean>
 */
export async function typeMatches(location: string): Promise<boolean> {
    return await utils.asyncFileExists(`${location}/package.json`);
}

/**
 * @function
 * @description Validate a nodejs project.
 *
 * @param operation <Required | Operation> - The validate operation for a nodejs project.
 *
 * @returns Promise<void>
 */
export async function validate(operation: Operation): Promise<void> {
    const validator = new Validator(operation);
    await validator.validateRequiredFiles(requiredFiles);

    validator.sendResult();
}

/**
 * @function
 * @description Set auto build for a nodejs project.
 *
 * @param operation <Required | Operation> - The validate operation for a nodejs project.
 *
 * @returns Promise<void>
 */
export async function setAutoBuild(operation: Operation): Promise<void> {
    if (process.env.IN_K8 !== "true") {
        projectUtil.containerUpdate(operation, "/file-watcher/scripts/nodejs-container.sh", operation.type);
    }
}

/**
 * @function
 * @description Get the container status of a nodejs project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 * @param containerName <Required | String> - The container name.
 * @param callback <Required | Function> - The callback function.
 *
 * @returns Promise<void>
 */
export async function getContainerStatus(projectInfo: ProjectInfo, containerName: string, callback: (any)): Promise<void> {
    // Do extra checking on the container if necessary.  This is only called if
    // the container is running.
    if (process.env.IN_K8 === "true") {
        // No extra checking needed for K8
        callback(undefined, ContainerStates.containerActive);
    } else {
        // Check that node is running in the container
        const command = "docker";
        const args = ["exec", containerName, "/scripts/noderun.sh", "isActive"];
        processManager.spawnDetached(projectInfo.projectID, command, args, {}, (result) => {
        const code = result.exitCode;
            if (code === 0) {
                callback(undefined, ContainerStates.containerActive);
            } else if (code === 1) {
                callback(undefined, ContainerStates.containerStopped);
            } else {
                callback("Error getting container status.  Code is: " + code, undefined);
            }
        });
    }
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
export async function getLogs(type: string, logDirectory: string, projectID: string, containerName: string): Promise<Array<AppLog | BuildLog>> {
    if (type.toLowerCase() != "build" && type.toLowerCase() != "app") return;
    return await logHelper.getLogs(type, logsOrigin, logDirectory, projectID, containerName);
}

/**
 * @function
 * @description Get the default app port of a nodejs project.
 *
 * @returns string
 */
export function getDefaultAppPort(): string {
    return "3000";
}

/**
 * @function
 * @description Get the default debug port of a nodejs project.
 *
 * @returns string
 */
export function getDefaultDebugPort(): string {
    return "9229";
}

/**
 * @function
 * @description Get the default ping timeout of a node project.
 *
 * @returns number
 */
export function getDefaultPingTimeout(): number {
    return 30;
}

/**
 * @function
 * @description Stop a nodejs project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function stop(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/nodejs-container.sh", "stop");
}

/**
 * @function
 * @description Start a nodejs project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function start(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/nodejs-container.sh", "start");
}

/**
 * @function
 * @description Get the project capabilities of a nodejs project.
 *
 * @returns ProjectCapabilities
 */
export function getCapabilities(): ProjectCapabilities {
    if (process.env.IN_K8 === "true") {
        return defaultProjectCapabilities;
    }
    return capabilities;
}


/**
 * @function
 * @description Rebuild operation for a nodejs project.
 *
 * @param operation <Required | Operation> - The create operation.
 *
 * @returns void
 */
export async function rebuild(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/nodejs-container.sh", "rebuild");
}
