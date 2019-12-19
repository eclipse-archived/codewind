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
import * as fs from "fs";
import { promisify } from "util";
import * as path from "path";
import * as projectUtil from "./projectUtil";
import * as utils from "../utils/utils";
import { SpringValidator } from "./SpringValidator";
import { Validator, ValidationResult, Severity, ProblemType } from "./Validator";
import { Operation } from "./operation";
import { ProjectInfo, BuildLog, AppLog } from "./Project";
import { ProjectCapabilities, defaultProjectCapabilities } from  "./Project";
import { StartModes, ControlCommands } from "./constants";
import * as locale from "../utils/locale";
import * as logger from "../utils/logger";
import * as logHelper from "./logHelper";
import * as projectEventsController from "../controllers/projectEventsController";

const readFileAsync = promisify(fs.readFile);

export const requiredFiles = [ "/Dockerfile", "/pom.xml" ];
const capabilities = new ProjectCapabilities([StartModes.run, StartModes.debug, StartModes.debugNoInit], [ControlCommands.restart]);

export const supportedType = "spring";
export const detectChangeByExtension: boolean = false;

const logsOrigin: logHelper.ILogTypes = {
    "build": {
        "container": {
            "files": {
                [logHelper.buildLogs.mavenBuild]: path.join(path.sep, "root", "logs", path.sep)
            }
        },
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
 * @description Relative path from project's root directory
 *
 * spring project directory contains:
 * Dockerfile		Dockerfile-tools	README.md		cli-config.yml		src
 * Dockerfile-build	Jenkinsfile		chart			pom.xml			target
 * .m2     .gitignore          .cw-settings
 *
 * only want to watch ["/src", "/pom.xml", "/Dockerfile", "/Dockerfile-build", "/.cw-settings"], and "/chart" if on cloud
 * .swp, swx, 4913 files are all temporary files created by vim & vi, need to ignore thoses files
 *
 */
export const defaultIgnoredPath: string[] = ["/.project", "/target", "/Dockerfile-tools",
                                             "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.m2", "/load-test*",
                                             "*/node_modules*", "*/.git/*", "*/.DS_Store", "*/*.swp", "*/*.swx",
                                             "*/4913", "*/.dockerignore", "*/.gitignore", "*/*~", "/.settings", "/localm2cache.zip"];
if (!process.env.IN_K8) {
    defaultIgnoredPath.push("/chart");
}

/**
 * @function
 * @description Create operation for a spring project.
 *
 * @param operation <Required | Operation> - The create operation.
 *
 * @returns void
 */
export function create(operation: Operation): void {
    projectUtil.containerCreate(operation, "/file-watcher/scripts/spring-container.sh", "create");
}

/**
 * @function
 * @description Update operation for a spring project.
 *
 * @param operation <Required | Operation> - The update operation.
 * @param changedFiles <Optional | projectEventsController.IFileChangeEvent[]> - The file changed event array.
 *
 * @returns void
 */
export function update(operation: Operation, changedFiles?: projectEventsController.IFileChangeEvent[]): void {
    projectUtil.containerUpdate(operation, "/file-watcher/scripts/spring-container.sh", "update");
}

/**
 * @function
 * @description Delete the container for a spring project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function deleteContainer(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.containerDelete(projectInfo, "/file-watcher/scripts/spring-container.sh");
}

/**
 * @function
 * @description Check to see if the project in the given location is of type spring project.
 *
 * @param location <Required | String> - The folder location of the project.
 *
 * @returns Promise<boolean>
 */
export async function typeMatches(location: string): Promise<boolean> {
    const file = `${location}/pom.xml`;
    if (await utils.asyncFileExists(`${location}/pom.xml`)) {
        const data = await readFileAsync(file, "utf8");
        return data.indexOf("<groupId>org.springframework.boot</groupId>") >= 0;
    }
    return false;
}

/**
 * @function
 * @description Validate a spring project.
 *
 * @param operation <Required | Operation> - The validate operation for a spring project.
 *
 * @returns Promise<void>
 */
export async function validate(operation: Operation): Promise<void> {

    const validator = new SpringValidator(operation);

    await validator.validateRequiredFiles(requiredFiles);

    const filepath = operation.projectInfo.location + "/pom.xml";
    try {
        if (await utils.asyncFileExists(filepath)) {
            const pomResults: any = await validator.validatePOM(filepath);
            pomResults.forEach((val: any) => {validator.results.push(val); });
        }
    } catch (err) {
        logger.logProjectError("POM validation encountered an error.", operation.projectInfo.projectID);
        logger.logProjectError(err, operation.projectInfo.projectID);
        const filename = Validator.prototype.getFileName(filepath);
        const relativePath = filepath.replace("/codewind-workspace/", "");
        const result = new ValidationResult(
            Severity.error,
            filename,
            relativePath,
            ProblemType.invalid,
            await locale.getTranslation("springProject.pomParsingError"),
            "XML parsing error: " + err
        );
        validator.results.push(result);
    }

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
 * @description Get the default app port of a spring project.
 *
 * @returns string
 */
export function getDefaultAppPort(): string {
    return "8080";
}

/**
 * @function
 * @description Get the default debug port of a spring project.
 *
 * @returns string
 */
export function getDefaultDebugPort(): string {
    return "7777";
}

/**
 * @function
 * @description Get the default ping timeout of a spring project.
 *
 * @returns number
 */
export function getDefaultPingTimeout(): number {
    return 30;
}

/**
 * @function
 * @description Stop a spring project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function stop(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/spring-container.sh", "stop");
}

/**
 * @function
 * @description Start a spring project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function start(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/spring-container.sh", "start");
}

/**
 * @function
 * @description Get the project capabilities of a spring project.
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
 * @description Rebuild a spring project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function rebuild(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/spring-container.sh", "create");
}
