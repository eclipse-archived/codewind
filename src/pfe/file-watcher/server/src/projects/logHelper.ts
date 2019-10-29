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
import * as path from "path";
import { promisify } from "util";
import * as utils from "../utils/utils";
import * as logger from "../utils/logger";
import * as projectsController from "../controllers/projectsController";
import * as dockerutil from "../utils/dockerutil";
import * as kubeutil from "../utils/kubeutil";
import { BuildLog, AppLog } from "./Project";
import { ContainerStates } from "../projects/constants";

const statAsync = promisify(fs.stat);
const existsSync = promisify(fs.exists);
const mkdirSync = promisify(fs.mkdir);

export const buildLogs = {
    "dockerBuild": "docker.build", // docker image build log file
    "dockerApp": "docker.app", // docker app build log file
    "mavenBuild": "maven.build", // maven build log file
    "appCompilation": "app.compile", // app compilation log file
};

const defaultAppLogs = {
    "app": "app" // app container log file available for all projects
};

export const libertyAppLogs = {
    "messages": "messages", // for liberty project messages log
    "console": "console" // for liberty project console log
};

export const appLogs = Object.assign(defaultAppLogs, libertyAppLogs);

export const logExtension = ".log";

export interface LogFiles {
    file: string;
    time: number;
}

export const logFileLists: any = {};

interface ILogInstance {
    files?: string[];
    dirs?: string[];
    bestTime?: number;
    containerName?: string;
    podName?: string;
}

interface ILogOriginFolderOrFiles {
    [x: string]: string;
}

export interface ILogOriginTypes {
    files?: ILogOriginFolderOrFiles;
    dirs?: ILogOriginFolderOrFiles;
}

interface ILogOrigins {
    container?: ILogOriginTypes;
    workspace?: ILogOriginTypes;
}

export interface ILogTypes {
    build?: ILogOrigins;
    app?: ILogOrigins;
}

/**
 * @function
 * @description Get list of log files in most recent completed order.
 *
 * @param logDirectory <Required | String> - The directory to fetch the logs from.
 * @param logSuffix <Required | Array<String>> - The suffix of the log name e.g. `docker_build` or `app`.
 *
 * @returns Promise<Array<LogFiles>>
 */
export async function getLogFiles(logDirectory: string, logSuffix: Array<string>): Promise<Array<LogFiles>> {
    try {
        const logs = await getLogFilesOrFoldersWithTimestamp(logDirectory, logSuffix);
        return logs;
    } catch (err) {
        logger.logError("Failed to get the list of log files from workspace " + logDirectory);
        logger.logError(err);
        return;
    }
}

 /**
  * @function
  * @description Get log files with timestap.
  *
  * @param logDirectory <Required | String> - The directory to fetch the logs from.
  * @param logSuffix <Optional | Array<String> - The suffix of the log name e.g. `docker_build` or `app`.
  * @param folderName <Optional | String> - An option to check for folder names as well.
  *
  * @returns Promise<Array<LogFiles>>
  */
 export async function getLogFilesOrFoldersWithTimestamp(logDirectory: string, logSuffix: Array<string>, folderName?: string): Promise<Array<LogFiles>> {
    const logs: Array<LogFiles> = [];

    if (folderName) {
        const logPath = path.join(logDirectory, folderName);
        if (await utils.asyncFileExists(logPath)) {
            const timestamp = (await statAsync(logPath)).mtime.getTime();
            logs.push({file: logPath, time: timestamp});
        }
        return logs;
    }

     for (const suffix of logSuffix) {
        const logPath = path.join(logDirectory, suffix + ".log");

         if (await utils.asyncFileExists(logPath)) {
            const timestamp = (await statAsync(logPath)).mtime.getTime();
            logs.push({file: logPath, time: timestamp});
        }
    }

     return logs;
}

 /**
  * @function
  * @description
  *
  * @param logFiles <Required | Array<LogFiles>> - List of log files along with the timestamp.
  *
  * @returns Promise<Array<string>>
  */
 export async function sortLogFiles(logFiles: Array<LogFiles>): Promise<Array<string>> {
    return logFiles.sort((a, b) => {
        return b.time - a.time;
    }).map((element) => {
        return element.file;
    });
}

/**
 * @function
 * @description Get log files from an app container. Used by liberty project on Windows.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param containerName <Required | String> - The docker container name.
 * @param logDirectory <Required | String> - The path to the log directory.
 * @param logSuffix <Optional | Array<String>> - The suffix of the log name e.g. `docker_build` or `app`.
 *
 * @returns Promise<Array<LogFiles>>
 */
export async function getLogFilesFromContainer(projectID: string, containerName: string, logDirectory: string, logSuffix: Array<string>): Promise<Array<LogFiles>> {
    try {
        const containerIsActive = await (process.env.IN_K8 ? kubeutil : dockerutil).isContainerActive(containerName);
        if (!containerName || containerIsActive.state === ContainerStates.containerNotFound) return [];
        const logFiles =  await (process.env.IN_K8 ? kubeutil : dockerutil).getFilesOrFoldersInContainerWithTimestamp(projectID, containerName, logDirectory);
        logSuffix = logSuffix.map((value) => {
            return value + logExtension;
        });
        const logFilesArr: Array<LogFiles> = [];
        for (const entry of logFiles) {
            for (const suffix of logSuffix) {
                if (entry.file.indexOf(suffix) > -1) logFilesArr.push(entry);
            }
        }
        return logFilesArr;
    } catch (err) {
        logger.logError("Failed to get the list of log files from container " + logDirectory);
        logger.logError(err);
        return;
    }
}

/**
 * @function
 * @description Create a directory for storing log files for a project.
 *
 * @param dirName <Required | String> - The directory name for storing the log, in the form of <project_name-project_id>.
 * @param logPath <Required | String> - The log path for the directory.
 *
 * @returns Promise<void>
 */
export async function createLogDir(dirName: string, logPath: string): Promise<string> {
    if (!dirName || !logPath) return undefined;

    const folderpath = path.join(logPath, dirName);

    if (!(await existsSync(folderpath))) {
        await mkdirSync(folderpath);
        logger.logInfo("Log directory created at: " + folderpath);
    } else {
        logger.logInfo("Log directory found at: " + folderpath + "\nSkipping directory creation.");
    }
    return folderpath;
}

/**
 * @function
 * @description Removes the directory for storing log files for a project.
 *
 * @param dirName <Required | String> - The directory name for storing the log, in the form of <project_name-project_id>.
 * @param logPath <Optional | String> - The log path for the directory.
 *
 * @returns Promise<void>
 */
export async function removeLogDir(dirName: string, logPath: string): Promise<void> {
    if (!dirName || !logPath) return;

    const folderpath = path.join(logPath, dirName);

    if (await existsSync(folderpath)) {
        await projectsController.deleteFolder(folderpath);
        logger.logInfo("Log directory removed from: " + folderpath);
    } else {
        logger.logError("No log directory found at: " + folderpath);
    }
}

/**
 * @function
 * @description Get the log directory name for a project.
 *
 * @param projectName <Required | String> - The project name.
 * @param projectID <Required | String> - The alpha-numeric id for the project.
 *
 * @returns string
 */
export async function getLogDir(projectID: string, projectName?: string): Promise<string> {
    if (!projectID) {
        logger.logProjectError("Project id is a required parameter to get the log directory.", undefined, projectName);
        return;
    } else if (!projectName) {
        projectName = await logger.getProjectNameByProjectID(projectID);
    }
    return projectName + "-" + projectID;
}

/**
 * @function
 * @description Get logs from specific files or folders.
 *
 * @param origin <Required | String> - The origin of the logs ("container" or "workspace")
 * @param logSource <Required | String> - The source of the logs ("files" or "dirs")
 * @param logsOrigin <Required | ILogOriginFolderOrFiles> - The object containing the logs tree.
 * @param logDirectory <Required | String> - The log location directory.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param containerName <Required | String> - The docker container name.
 *
 * @returns Promise<Array<LogFiles>>
 */
async function getLogsFromFilesOrFolders(origin: string, logSource: string, logsOrigin: ILogOriginFolderOrFiles, logDirectory: string, projectID: string, containerName: string): Promise<Array<LogFiles>> {
    const logs = Object.keys(logsOrigin);
    let allLogs: LogFiles[] = [];

    for (const log of logs) {
        const logDir = logsOrigin[log] || logDirectory;
        let receivedLogs: LogFiles[];

        if (logSource.toLowerCase() === "files") {
            receivedLogs = await getLogFromFiles(logDir, log, projectID, containerName, origin);
        } else if (logSource.toLowerCase() === "dirs") {
            receivedLogs = await getLogFromDirs(logDir, log, projectID, containerName, origin);
        }

        if (receivedLogs && receivedLogs.length > 0) {
            allLogs = allLogs.concat(receivedLogs);
        }
    }
    return allLogs;
}

/**
 * @function
 * @description Get logs from specific origin type.
 *
 * @param origin <Required | String> - The origin of the logs ("container" or "workspace")
 * @param logsOrigin <Required | ILogOriginTypes> - The object containing the logs tree.
 * @param logDirectory <Required | String> - The log location directory.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param containerName <Required | String> - The docker container name.
 *
 * @returns Promise<ILogInstance>
 */
async function getLogsFromOriginTypes(origin: string, logsOrigin: ILogOriginTypes, logDirectory: string, projectID: string, containerName: string): Promise<ILogInstance> {
    const logSources = Object.keys(logsOrigin);
    const currentLog: ILogInstance = {};

    for (const logSource of logSources) {
        let receivedLogs: LogFiles[] = [];

        if (logSource.toLowerCase() === "files") {
            receivedLogs = await getLogsFromFilesOrFolders(origin, logSource, logsOrigin.files, logDirectory, projectID, containerName);
            if (receivedLogs && receivedLogs.length > 0) {
                currentLog.files = await sortLogFiles(receivedLogs);
                const bestTime = receivedLogs.map((value: LogFiles) => {
                    if (currentLog.files[0] === value.file) return value.time;
                })[0];
                currentLog.bestTime = currentLog.bestTime ? Math.max(currentLog.bestTime, bestTime) : bestTime;
            }
        } else if (logSource.toLowerCase() === "dirs") {
            receivedLogs = await getLogsFromFilesOrFolders(origin, logSource, logsOrigin.dirs, logDirectory, projectID, containerName);
            if (receivedLogs && receivedLogs.length > 0) {
                currentLog.dirs = await sortLogFiles(receivedLogs);
                const bestTime = receivedLogs.map((value: LogFiles) => {
                    if (currentLog.dirs[0] === value.file) return value.time;
                })[0];
                currentLog.bestTime = currentLog.bestTime ? Math.max(currentLog.bestTime, bestTime) : bestTime;
            }
        }
    }
    return currentLog;
}

/**
 * @function
 * @description Get logs from the origin.
 *
 * @param logsOrigin <Required | ILogOrigins> - The object containing the logs tree.
 * @param logDirectory <Required | String> - The log location directory.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param containerName <Required | String> - The docker container name.
 *
 * @returns Promise<Array<AppLog | BuildLog>>
 */
async function getLogsFromOrigin(logsOrigin: ILogOrigins, logDirectory: string, projectID: string, containerName: string): Promise<Array<AppLog | BuildLog>> {
    const origins = Object.keys(logsOrigin);
    let resultLogs: Array<AppLog | BuildLog> = [];

    for (const origin of origins) {
        const currentLog: AppLog | BuildLog = {
            origin: origin,
            files: []
        };

        let logInst: ILogInstance;
        if (origin.toLowerCase() === "container") {
            logInst = await getLogsFromOriginTypes(origin, logsOrigin.container, logDirectory, projectID, containerName);
            if (process.env.IN_K8)  {
                logInst.podName = await kubeutil.getPodName(projectID, "release=" + containerName);
            } else {
                logInst.containerName = containerName;
            }
        } else if (origin.toLowerCase() === "workspace") {
            logInst = await getLogsFromOriginTypes(origin, logsOrigin.workspace, logDirectory, projectID, containerName);
        }

        if (logInst.files) {
            currentLog.files = logInst.files;
        }
        if (logInst.dirs) {
            currentLog.dirs = logInst.dirs;
        }
        if (logInst.bestTime) {
            currentLog.bestTime = logInst.bestTime;
        }
        if (logInst.containerName) {
            currentLog.containerName = logInst.containerName;
        }
        if (logInst.podName) {
            currentLog.podName = logInst.podName;
        }

        if ((currentLog.files && currentLog.files.length > 0) || (currentLog.dirs && currentLog.dirs.length > 0)) {
            resultLogs.push(currentLog);
        }
    }

    if (resultLogs && resultLogs.length > 0) {
        resultLogs = resultLogs.sort((a, b) => {
            return b.bestTime - a.bestTime;
        }).map((obj: AppLog) => {
            delete obj.bestTime;
            return obj;
        });
    }

    return resultLogs;
}

/**
 * @function
 * @description Get logs from files or directories.
 *
 * @param type <Required | String> - The type of log ("build" or "app")
 * @param logsOrigin <Required | ILogTypes> - The object containing the logs tree.
 * @param logDirectory <Required | String> - The log location directory.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param containerName <Required | String> - The docker container name.
 *
 * @returns Promise<Array<AppLog | BuildLog>>
 */
export async function getLogs(type: string, logsOrigin: ILogTypes, logDirectory: string, projectID: string, containerName: string): Promise<Array<AppLog | BuildLog>> {
    // check if type is either "build" or "app"
    if (type.toLowerCase() != "build" && type.toLowerCase() != "app") return;

    let resultLogs: Array<AppLog | BuildLog> = [];

    if (type.toLowerCase() === "build") {
        resultLogs = await getLogsFromOrigin(logsOrigin.build, logDirectory, projectID, containerName);
    } else if (type.toLowerCase() === "app") {
        resultLogs = await getLogsFromOrigin(logsOrigin.app, logDirectory, projectID, containerName);
    }

    return resultLogs;
}

/**
 * @function
 * @description List logs from specific files.
 *
 * @param logDirectory <Required | String> - The log location directory.
 * @param logSuffix <Required | String> - The suffix of the log name e.g. `docker_build` or `app`.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param containerName <Required | String> - The docker container name.
 * @param origin <Optional | String> - The origin of the logs ("container" or "workspace"), defaults to "workspace"
 */
export async function getLogFromFiles(logDirectory: string, logSuffix: string, projectID: string, containerName: string, origin: string = "workspace"): Promise<LogFiles[]> {
    let logs;

    if (origin.toLowerCase() === "workspace") {
        logs = await getLogFiles(logDirectory, [logSuffix]);
    } else if (origin.toLowerCase() === "container") {
        if (!containerName) return;
        logs = await getLogFilesFromContainer(projectID, containerName, logDirectory, [logSuffix]);
    }

    if (logs && logs.length === 0) return;
    return logs;
}

/**
 * @function
 * @description List logs from specific folders.
 *
 * @param logDirectory <Required | String> - The log location directory.
 * @param folderName <Required | String> - The log folder name.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param containerName <Required | String> - The docker container name.
 * @param origin <Optional | String> - The origin of the logs ("container" or "workspace"), defaults to "workspace"
 */
export async function getLogFromDirs(logDirectory: string, folderName: string, projectID: string, containerName: string, origin: string = "workspace"): Promise<LogFiles[]> {
    let logs;

    if (origin.toLowerCase() === "workspace") {
        logs = await getLogFilesOrFoldersWithTimestamp(logDirectory, [], folderName);
    } else if (origin.toLowerCase() === "container") {
        if (!containerName) return;
        logs = await (process.env.IN_K8 ? kubeutil : dockerutil).getFilesOrFoldersInContainerWithTimestamp(projectID, containerName, logDirectory, folderName);
    }

    if (logs.length === 0) return;
    return logs;
}
