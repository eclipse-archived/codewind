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
import { BuildLog, AppLog } from "./Project";

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

/**
 * @function
 * @description Get list of log files in most recent completed order.
 *
 * @param logDirectory <Required | String> - The directory to fetch the logs from.
 * @param logSuffix <Required | Array<String>> - The suffix of the log name e.g. `docker_build` or `app`.
 *
 * @returns Promise<Array<string>>
 */
export async function getLogFiles(logDirectory: string, logSuffix: Array<string>): Promise<Array<string>> {
    try {
        const logs = await getLogFilesWithTimestamp(logDirectory, logSuffix);
        const logList = await sortLogFiles(logs);

        return logList;
    } catch (err) {
        logger.logError("Failed to get the list of log files from " + logDirectory);
        logger.logError(err);
        return;
    }
}

 /**
  * @function
  * @description Get log files with timestap.
  *
  * @param logDirectory <Required | String> - The directory to fetch the logs from.
  * @param logSuffix <Optional | Array<String>> - The suffix of the log name e.g. `docker_build` or `app`.
  *
  * @returns Promise<Array<string>>
  */
 export async function getLogFilesWithTimestamp(logDirectory: string, logSuffix: Array<string>): Promise<Array<LogFiles>> {
    const logs: Array<LogFiles> = [];

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
        const logFiles = await dockerutil.getFilesInContainerWithTimestamp(projectID, containerName, logDirectory);
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
        logger.logError("Failed to get the list of log files from " + logDirectory);
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
 * @description Default function to get build logs given the log directory and log suffixes
 *
 * @param logDirectory <Required | String> - The log location directory.
 * @param logSuffixes <Required | Array<string> - The list of log file suffixes
 *
 * @returns Promise<BuildLog>
 */
export async function getBuildLogs(logDirectory: string, logSuffixes: Array<string>): Promise<BuildLog> {
    const buildLog: BuildLog = {
        origin: "workspace",
        files: []
    };
    buildLog.files = await this.getLogFiles(logDirectory, logSuffixes);
    return buildLog;
}

/**
 * @function
 * @description Default function to get app logs given the log directory and log suffixes
 *
 * @param logDirectory <Required | String> - The log location directory.
 * @param logSuffixes <Required | Array<string> - The list of log file suffixes
 *
 * @returns Promise<AppLog>
 */
export async function getAppLogs(logDirectory: string, logSuffixes: Array<string>): Promise<AppLog> {
    const appLog: AppLog = {
        origin: "workspace",
        files: []
    };
    appLog.files = await this.getLogFiles(logDirectory, logSuffixes);
    return appLog;
}
