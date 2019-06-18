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
import * as constants from "../projects/constants";
import moment from "moment-timezone";
import * as stackTrace from "stack-trace";
const chalk = require("chalk"); // tslint:disable-line:no-require-imports

const readFileAsync = promisify(fs.readFile);
let previousInfoLog: String;
let previousErrorLog: String;
let previousFWInfoLog: String;
let previousFWErrorLog: String;

/**
 * @function
 * @description Get project name by the given project id.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns Promise<string>
 */
export async function getProjectNameByProjectID(projectID: string): Promise<string> {
    const projectDataFile = constants.projectConstants.projectsDataDir + projectID + "/" + projectID + ".json";
    const data = await readFileAsync(projectDataFile, "utf8");
    const projectData = JSON.parse(data);
    const location = projectData.location;
    const projectName = location.split("/").pop();
    return projectName;
}

/**
 * @function
 * @description Assert condition on a project state.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param condition <Required | Boolean> - The condition to be executed.
 * @param message <Required | String> - The error message to be logged if the condition fails.
 *
 * @returns void
 */
export function projectAssert(projectID: string, condition: boolean, message: string): void {
    if (!condition) {
        logProjectError(message, projectID);
    }
}

/**
 * @function
 * @description Assert condition on filewatcher state.
 *
 * @param condition <Required | Boolean> - The condition to be executed.
 * @param message <Required | String> - The error message to be logged if the condition fails.
 *
 * @returns void
 */
export function fileWatcherAssert(condition: boolean, message: string): void {
    if (!condition) {
        logFileWatcherError(message);
    }
}

/**
 * @function
 * @description Log project information.
 *
 * @param msg <Required | String> - The message to be logged.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param projectName <Optional | String> - The project name.
 *
 * @returns Promise<any>
 */
export async function logProjectInfo(msg: string, projectID: string, projectName?: string): Promise<any> {
    if (process.env.NODE_ENV === "test") return;

    if (!msg) {
        console.log(chalk.red("Log error: A message must be provided"));
        return;
    }
    if ( previousInfoLog === msg) {
        return;
    }

    previousInfoLog = msg;
    if (!projectID) {
        if (projectName) {
            logFileWatcherInfo(msg, projectName);
        } else {
            logFileWatcherInfo(msg);
        }
        return;
    }
    if (!projectName) {
        try {
            projectName = await getProjectNameByProjectID(projectID);
        } catch (err) {
            // Can't find a project name so log to the general FW logs using the project ID
            logFileWatcherInfo(`${projectID}: ${msg}`);
            return;
        }
    }

    const logPath = "/codewind-workspace/" + ".logs";
    const timestamp = moment().tz(moment.tz.guess()).format("ddd MMM D HH:mm:ss z YYYY");
    const logMsg = chalk.green("[INFO " + timestamp + " | Project: " + projectName + "] ") + msg;
    const fileWatcherLogPath = path.join(logPath, "FileWatcher.log");

    fs.appendFile(fileWatcherLogPath, "\n" + logMsg, (err) => {
        if (err) {
            console.log("File system error: " + err);
            console.log(err.stack);
        }
    });

    const logName = projectName + "-" + projectID;
    const projectLogPath = path.join(logPath, logName, logName + ".log");
    fs.appendFile(projectLogPath, "\n" + logMsg, (err) => {
        if (err) {
            console.log(chalk.red("File system error: ") + err);
            console.log(err.stack);
        }
    });

    console.log(logMsg);
}

/**
 * @function
 * @description Log project error.
 *
 * @param msg <Required | String> - The message to be logged.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param projectName <Optional | String> - The project name.
 *
 * @returns Promise<any>
 */
export async function logProjectError(msg: string, projectID: string, projectName?: string): Promise<any> {
    if (process.env.NODE_ENV === "test") return;

    if (!msg) {
        console.log(chalk.red("Log error: A message must be provided"));
        return;
    }
    if ( previousErrorLog === msg) {
        return;
    }

    previousErrorLog = msg;
    if (!projectID) {
        if (projectName) {
            logFileWatcherError(msg, projectName);
        } else {
            logFileWatcherError(msg);
        }
        return;
    }
    if (!projectName) {
        try {
            projectName = await getProjectNameByProjectID(projectID);
        } catch (err) {
            // Can't find a project name so log to the general FW logs using the project ID
            logFileWatcherError(`${projectID}: ${msg}`);
            return;
        }
    }

    const logPath = "/codewind-workspace/" + ".logs";
    const trace = stackTrace.get();

    const timestamp = moment().tz(moment.tz.guess()).format("ddd MMM D HH:mm:ss z YYYY");
    // const logMsg = chalk.red("[ERROR " + timestamp + " | Project: " + projectName + " | File Name: " + trace[1].getFileName() + " | Function Name: " + trace[1].getFunctionName() + " | Line Number: " + trace[1].getLineNumber() + "] ") + msg;
    const logMsg = chalk.red(`[ERROR ${timestamp} | Project: ${projectName}] ${msg}`);
    const fileWatcherLogPath = path.join(logPath, "FileWatcher.log");

    fs.appendFile(fileWatcherLogPath, "\n" + logMsg, (err) => {
        if (err) {
            console.log(chalk.red("File system error: ") + err);
            console.log(err.stack);
        }
    });

    const logName = projectName + "-" + projectID;
    const projectLogPath = path.join(logPath, logName, logName + ".log");
    fs.appendFile(projectLogPath, "\n" + logMsg, (err) => {
        if (err) {
            console.log(chalk.red("File system error: ") + err);
            console.log(err.stack);
        }
    });

    console.log(logMsg);
}

/**
 * @function
 * @description Log filewatcher information.
 *
 * @param msg <Required | String> - The message to be logged.
 * @param projectName <Optional | String> - The project name.
 *
 * @returns void
 */
export function logFileWatcherInfo(msg: string, projectName?: string): void {
    if (process.env.NODE_ENV === "test") return;

    if (!msg) {
        console.log(chalk.red("Log error: A message must be provided"));
    }
    if ( previousFWInfoLog === msg) {
        return;
    }

    previousFWInfoLog = msg;
    const timestamp = moment().tz(moment.tz.guess()).format("ddd MMM D HH:mm:ss z YYYY");
    let logMsg: string = undefined;

    if (projectName) {
        logMsg = chalk.green("[INFO " + timestamp + " | Project: " + projectName + "] ") + msg;
    } else {
        logMsg = chalk.green("[INFO " + timestamp + " | FileWatcher] ") + msg;
    }

    const logPath = "/codewind-workspace/" + ".logs";
    const fileWatcherLogPath = path.join(logPath, "FileWatcher.log");

    fs.appendFile(fileWatcherLogPath, "\n" + logMsg, (err) => {
        if (err) {
            console.log(chalk.red("File system error: ") + err);
            console.log(err.stack);
        }
    });

    console.log(logMsg);
}

/**
 * @function
 * @description Log filewatcher error.
 *
 * @param msg <Required | String> - The message to be logged.
 * @param projectName <Optional | String> - The project name.
 *
 * @returns void
 */
export function logFileWatcherError(msg: string, projectName?: string): void {
    if (process.env.NODE_ENV === "test") return;

    if (!msg) {
        console.log(chalk.red("Log error: A message must be provided"));
    }
    if ( previousFWErrorLog === msg) {
        return;
    }

    previousFWErrorLog = msg;
    const trace = stackTrace.get();
    const timestamp = moment().tz(moment.tz.guess()).format("ddd MMM D HH:mm:ss z YYYY");
    let logMsg: string = undefined;

    if (projectName) {
        logMsg = chalk.red("[ERROR " + timestamp + " | Project: " + projectName + " | File Name: " + trace[1].getFileName() + " | Function Name: " + trace[1].getFunctionName() + " | Line Number: " + trace[1].getLineNumber() + "] ") + msg;
    } else {
        logMsg = chalk.red("[ERROR " + timestamp + " | FileWatcher | File Name: " + trace[1].getFileName() + " | Function Name: " + trace[1].getFunctionName() + " | Line Number: " + trace[1].getLineNumber() + "] ") + msg;
    }

    const logPath = "/codewind-workspace/" + ".logs";
    const fileWatcherLogPath = path.join(logPath, "FileWatcher.log");

    fs.appendFile(fileWatcherLogPath, "\n" + logMsg, (err) => {
        if (err) {
            console.log(chalk.red("File system error: ") + err);
            console.log(err.stack);
        }
    });

    console.log(logMsg);
}
