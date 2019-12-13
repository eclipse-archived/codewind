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
import * as projectUtil from "./projectUtil";
import * as utils from "../utils/utils";
import { Validator } from "./Validator";
import { Operation } from "./operation";
import { ProjectInfo, BuildLog, AppLog } from "./Project";
import * as path from "path";
import * as logHelper from "./logHelper";
import * as projectEventsController from "../controllers/projectEventsController";

export const requiredFiles = [ "/Dockerfile", "/Dockerfile-tools", "/Package.swift" ];

export const supportedType = "swift";
export const detectChangeByExtension: boolean = false;

const logsOrigin: logHelper.ILogTypes = {
    "build": {
        "workspace": {
            "files": {
                [logHelper.buildLogs.dockerBuild]: undefined, // set during runtime
                [logHelper.buildLogs.dockerApp]: undefined,
                [logHelper.buildLogs.appCompilation]: undefined,
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
 * @description Relative path from project's root directory
 *
 * swift project directory contains:
 * Dockerfile		Package.resolved	Sources			debian
 * Dockerfile-tools	Package.swift		Tests			iterative-dev.sh
 * Jenkinsfile		README.md		chart			manifest.yml
 * LICENSE			README.rtf		cli-config.yml		terraform
 * .bluemix         .build-ubuntu     .gitignore          .cw-settings
 * .cfignore        .dockerignore      .swift-version      .swiftservergenerator-project
 * .yo-rc.json
 *
 * only want to watch ["/Sources", "/Tests", "/Package.swift", "/Dockerfile", "/Dockerfile-tools", "/.cw-settings"], and "/chart" if on cloud
 * .swp, swx, 4913 files are all temporary files created by vim & vi, need to ignore thoses files
 */
export const defaultIgnoredPath: string[] = ["/.project", "/LICENSE", "/Package.resolved", "README.rtf", "/debian", "/manifest.yml", "/load-test*",
                                             "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.bluemix", "/iterative-dev.sh", "/terraform",
                                            ".swift-version", "/.build-ubuntu", "/.cfignore", "/.swiftservergenerator-project", "/.yo-rc.json",
                                            "*/node_modules*", "*/.git/*", "*/.DS_Store", "*/*.swp", "*/*.swx", "*/4913", "*/.dockerignore",
                                            "*/.gitignore", "*/*~", "/.settings"];
if (!process.env.IN_K8) {
    defaultIgnoredPath.push("/chart");
}


/** *
 * @function
 * @description Create operation for a swift project.
 *
 * @param operation <Required | Operation> - The create operation.
 *
 * @returns void
 */
export function create(operation: Operation): void {
    projectUtil.containerCreate(operation, "/file-watcher/scripts/swift-container.sh", "create");
}

/**
 * @function
 * @description Update operation for a swift project.
 *
 * @param operation <Required | Operation> - The update operation.
 * @param changedFiles <Optional | projectEventsController.IFileChangeEvent[]> - The file changed event array.
 *
 * @returns void
 */
export function update(operation: Operation, changedFiles?: projectEventsController.IFileChangeEvent[]): void {
    projectUtil.containerUpdate(operation, "/file-watcher/scripts/swift-container.sh", "update");
}

/**
 * @function
 * @description Delete the container for a swift project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function deleteContainer(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.containerDelete(projectInfo, "/file-watcher/scripts/swift-container.sh");
}

/**
 * @function
 * @description Check to see if the project in the given location is of type swift project.
 *
 * @param location <Required | String> - The folder location of the project.
 *
 * @returns Promise<boolean>
 */
export async function typeMatches(location: string): Promise<boolean> {
    return await utils.asyncFileExists(`${location}/Package.swift`);
}

/**
 * @function
 * @description Validate a swift project.
 *
 * @param operation <Required | Operation> - The validate operation for a swift project.
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
 * @description Get the default app port of a swift project.
 *
 * @returns string
 */
export function getDefaultAppPort(): string {
    return "8080";
}

/**
 * @function
 * @description Get the default ping timeout of a swift project.
 *
 * @returns number
 */
export function getDefaultPingTimeout(): number {
    return 30;
}