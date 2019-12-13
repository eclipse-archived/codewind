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
import { Operation } from "./operation";
import { ProjectInfo, AppLog, BuildLog } from "./Project";
import * as path from "path";
import * as projectUtil from "./projectUtil";
import * as utils from "../utils/utils";
import { getTranslation } from "../utils/locale";
import { LibertyValidator } from "./LibertyValidator";
import * as dockerutil from "../utils/dockerutil";
import { Validator, ValidationResult, Severity, ProblemType } from "./Validator";
import { ProjectCapabilities, defaultProjectCapabilities } from  "./Project";
import { StartModes, ControlCommands } from "./constants";
import * as locale from "../utils/locale";
import * as logger from "../utils/logger";
import * as logHelper from "./logHelper";
import * as kubeutil from "../utils/kubeutil";
import * as projectEventsController from "../controllers/projectEventsController";
import { ProcessResult } from "../utils/processManager";


const readFileAsync = promisify(fs.readFile);

const serverXmlPath = "/src/main/liberty/config/server.xml";

export const requiredFiles = [ "/Dockerfile | /Dockerfile-lang", "/Dockerfile-build", "/pom.xml", serverXmlPath ];
const capabilities = new ProjectCapabilities([StartModes.run, StartModes.debug], [ControlCommands.restart]);

export const supportedType: string = "liberty";
export const detectChangeByExtension: boolean = false;

const inContainerAppLogsDirectory = path.join(process.env.HOST_OS === "windows" ? path.join(path.sep, "tmp", "liberty") : path.join(path.sep, "home", "default", "app", "mc-target"), "liberty", "wlp", "usr", "servers", "defaultServer", "logs");

const logsOrigin: logHelper.ILogTypes = {
    "build": {
        "container": {
            "files": {
                [logHelper.buildLogs.mavenBuild]: path.join(path.sep, "home", "default", "logs")
            }
        },
        "workspace": {
            "files": {
                [logHelper.buildLogs.dockerBuild]: undefined // set during runtime
            }
        }
    },
    "app": {
        "container": {
            "files": {
                [logHelper.appLogs.console]: inContainerAppLogsDirectory,
                [logHelper.appLogs.messages]: inContainerAppLogsDirectory
            },
            "dirs": {
                "ffdc": inContainerAppLogsDirectory
            }
        },
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
 * liberty project directory contains:
 * Dockerfile		Jenkinsfile		cli-config.yml		src
 * Dockerfile-build	README.md		mc-target		target
 * Dockerfile-tools	chart			pom.xml
 * .cfignore        .dockerignore       .gitignore          .cw-settings
 *
 * only want to watch ["/src", "/pom.xml", "/Dockerfile-build", "/.cw-settings", "/Dockerfile"], and "/chart" if on cloud
 * .swp, swx, 4913 files are all temporary files created by vim & vi, need to ignore thoses files
 *
 */
export const defaultIgnoredPath: string[] = ["/.project", "/Dockerfile-tools", "/target",
                                             "/mc-target", "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.cfignore", "/load-test*",
                                             "*/node_modules*", "*/.git/*", "*/.DS_Store", "*/*.swp", "*/*.swx", "*/4913", "*/.dockerignore",
                                             "*/.gitignore", "*/*~", "/.settings", "/localm2cache.zip", "/libertyrepocache.zip"];
if (!process.env.IN_K8) {
    defaultIgnoredPath.push("/chart");
}

/**
 * @function
 * @description Create operation for a liberty project.
 *
 * @param operation <Required | Operation> - The create operation.
 *
 * @returns void
 */
export function create(operation: Operation): void {
    projectUtil.containerCreate(operation, "/file-watcher/scripts/liberty-container.sh", "create");
}

/**
 * @function
 * @description Update operation for a liberty project.
 *
 * @param operation <Required | Operation> - The update operation.
 * @param changedFiles <Optional | projectEventsController.IFileChangeEvent[]> - The file changed event array.
 *
 * @returns void
 */
export function update(operation: Operation, changedFiles?: projectEventsController.IFileChangeEvent[]): void {
    projectUtil.containerUpdate(operation, "/file-watcher/scripts/liberty-container.sh", "update");
}

/**
 * @function
 * @description Delete the container for a liberty project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function deleteContainer(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.containerDelete(projectInfo, "/file-watcher/scripts/liberty-container.sh");
}

/**
 * @function
 * @description Check to see if the project in the given location is of type liberty project.
 *
 * @param location <Required | String> - The folder location of the project.
 *
 * @returns Promise<boolean>
 */
export async function typeMatches(location: string): Promise<boolean> {
    const file = `${location}/pom.xml`;
    if (await utils.asyncFileExists(`${location}/pom.xml`)) {
        const data = await readFileAsync(file, "utf8");
        return data.indexOf("<groupId>net.wasdev.wlp.maven.plugins</groupId>") >= 0;
    }
    return false;
}

/**
 * @function
 * @description Validate a liberty project.
 *
 * @param operation <Required | Operation> - The validate operation for a liberty project.
 *
 * @returns Promise<void>
 */
export async function validate(operation: Operation): Promise<void> {

    const validator = new LibertyValidator(operation);

    await validator.validateRequiredFiles(requiredFiles);

    // Separately validate the server.xml and pom.xml since these files are required for successful builds
    const fullServerXmlPath = path.join(operation.projectInfo.location, serverXmlPath);

    if (!await utils.asyncFileExists(fullServerXmlPath)) {
        logger.logProjectError("server.xml not found at: " + fullServerXmlPath, operation.projectInfo.projectID);
        const missingServerXmlMsg = await getTranslation("buildApplicationTask.missingServerXml", { path: fullServerXmlPath });
        await logBuildEvent(operation.projectInfo, missingServerXmlMsg, true);
    }

    const filepath = operation.projectInfo.location + "/pom.xml";
    try {
        if (await utils.asyncFileExists(filepath)) {
            const pomResults = await validator.validatePOM(filepath);
            pomResults.forEach((val: any) => { validator.results.push(val); });
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
            await locale.getTranslation("libertyProject.pomParsingError"),
            "POM parsing error: " + err
        );
        validator.results.push(result);
    }
    const dockerfileBuildPath = operation.projectInfo.location + "/Dockerfile-build";
    try {
        if (await utils.asyncFileExists(dockerfileBuildPath)) {
            const dockerfileBuildResults = await validator.validateDockerfileBuild(dockerfileBuildPath);
            dockerfileBuildResults.forEach((val: any) => { validator.results.push(val); });
        }
    } catch (err) {
        logger.logProjectError("Dockerfile-Build validation encountered an error.", operation.projectInfo.projectID);
        logger.logProjectError(err, operation.projectInfo.projectID);

        const filename = Validator.prototype.getFileName(dockerfileBuildPath);
        const relativePath = dockerfileBuildPath.replace("/codewind-workspace/", "");
        const result = new ValidationResult(
            Severity.error,
            filename,
            relativePath,
            ProblemType.invalid,
            await locale.getTranslation("libertyProject.DockerfileBuildParsingError"),
            "Dockerfile-Build parsing error: " + err
        );
        validator.results.push(result);
    }

    validator.sendResult();
}

/**
 * @function
 * @description Log a message to the build.log for the given project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 * @param msg <Required | String> - The build log message.
 * @param isError <Required | Boolean> - Boolean to append error to the log.
 *
 * @returns Promise<any>
 */
export async function logBuildEvent(projectInfo: ProjectInfo, msg: String, isError: boolean): Promise<any> {
    // have the message match the Maven format
    const msgLabel = isError ? "ERROR" : "INFO";
    const fullMsg = `\n[${msgLabel}] ${msg}`;

    let buildLogPath;
    let buildLog: projectUtil.ProjectLog;

    try {
        buildLog = await projectUtil.getProjectLogs(projectInfo);
    } catch (err) {
        logger.logProjectError("Failed to get project logs during log build event", projectInfo.projectID);
        return;
    }

    if (buildLog && buildLog.build) {
        // the log build event is only called from liberty project and the file info is dumped into maven build file
        buildLog.build.filter((logInstance) => {
            if (logInstance && logInstance.files) {
                logInstance.files.filter((value) => {
                    if (value.indexOf(logHelper.buildLogs.mavenBuild) > -1) {
                        buildLogPath = value;
                        return;
                    }
                });
            }
        });
    } else {
        logger.logProjectError("Could not get build log for project", projectInfo.projectID);
        return;
    }

    const containerName = await projectUtil.getContainerName(projectInfo);
    const targetContainer = process.env.IN_K8 === "true" ? await kubeutil.getPodName(projectInfo.projectID, `release=${containerName}`) : containerName;

    logger.logProjectInfo(`Writing to build log in container ${targetContainer} at ${buildLog} :\n\t${fullMsg}`, projectInfo.projectID);

    // if the build log path is defined, only then we write it
    if (buildLogPath && targetContainer) {
        const cmd = `echo "${fullMsg}" >> ${buildLogPath}`;
        const args = process.env.IN_K8 === "true" ? ["exec", "-i", targetContainer, "--", "sh", "-c", cmd] : ["exec", "-i", targetContainer, "sh", "-c", cmd];
        let data: ProcessResult;
        if (process.env.IN_K8 === "true") {
            data = await kubeutil.runKubeCommand(projectInfo.projectID, args);
        } else {
            data = await dockerutil.runDockerCommand(projectInfo.projectID, args);
        }
        if (data && data.exitCode != 0) {
            logger.logProjectError("File system error writing to build log: " + data.stderr, projectInfo.projectID);
            return;
        }
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
 * @description Get the default app port of a liberty project.
 *
 * @returns string
 */
export function getDefaultAppPort(): string {
    return "9080";
}

/**
 * @function
 * @description Get the default debug port of a liberty project.
 *
 * @returns string
 */
export function getDefaultDebugPort(): string {
    return "7777";
}

/**
 * @function
 * @description Get the default ping timeout of a liberty project.
 *
 * @returns number
 */
export function getDefaultPingTimeout(): number {
    return 30;
}

/**
 * @function
 * @description Stop a liberty project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function stop(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/liberty-container.sh", "stop");
}

/**
 * @function
 * @description Start a liberty project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function start(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/liberty-container.sh", "start");
}

/**
 * @function
 * @description Rebuild a liberty project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function rebuild(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/liberty-container.sh", "rebuild");
}

/**
 * @function
 * @description Get the project capabilities of a liberty project.
 *
 * @returns ProjectCapabilities
 */
export function getCapabilities(): ProjectCapabilities {
    if (process.env.IN_K8 === "true") {
        return defaultProjectCapabilities;
    }
    return capabilities;
}
