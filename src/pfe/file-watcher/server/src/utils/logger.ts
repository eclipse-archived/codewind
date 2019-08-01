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
import * as stackTrace from "stack-trace";
const chalk = require("chalk"); // tslint:disable-line:no-require-imports

const GENERAL_LOG_FILE_NAME = "Turbine.log";
import { configure, getLogger } from "log4js";

export interface ISetLogLevelSuccess {
    status: "success";
}

export interface ISetLogLevelFailure {
    status: "failed";
    error: { msg: string };
}

const LogLevel = {
    error: "error",
    warn: "warn",
    info: "info",
    debug: "debug",
    trace: "trace"
};

const logPath = constants.projectConstants.projectsLogDir;
const turbineLogPath = path.join(logPath, GENERAL_LOG_FILE_NAME);

const contextName = "context";
let logger = getLogger();

const readFileAsync = promisify(fs.readFile);
let previousProjectInfoLog: String;
let previousProjectErrorLog: String;
let previousInfoLog: String;
let previousErrorLog: String;

setLoggingLevel(LogLevel.info);

export async function setLoggingLevel(level: string): Promise<void> {
    let logLevel = LogLevel.info;
    if (level in LogLevel) {
        logLevel = level;
    } else {
        const errMsg = `${level} is not a valid value, the following log levels are available ${JSON.stringify(LogLevel)}`;
        logError(errMsg);
        throw new Error(errMsg);
    }
    configure({
        appenders: {
            "out": {
                type: "stdout",
                layout: {
                    type: "pattern",
                    pattern: `%[[%d{dd/MM/yy hh:mm:ss} %X{${contextName}}] [%p]%] %m`
                }
            },
            "mainlogfile": {
                type: "file",
                filename: turbineLogPath,
                layout: {
                    type: "pattern",
                    pattern: `%[[%d{dd/MM/yy hh:mm:ss} %X{${contextName}}] [%p]%] %m`
                },
                maxLogSize: 10458760,
                backups: 3
            }
        },
        categories: {
            default: { appenders: ["mainlogfile", "out"], level: logLevel },
        }
    });
    logger = getLogger();
    logInfo(`The current log level is ${logLevel}`);
}

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
 * @description Log based on whether a condition is false.
 *
 * @param condition <Required | Boolean> - The condition to be checked.
 * @param message <Required | String> - The error message to be logged if the condition fails.
 *
 * @returns void
 */
export function assert(condition: boolean, message: string): void {
    if (!condition) {
        logError(message);
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
    if (previousProjectInfoLog === msg) {
        return;
    }

    previousProjectInfoLog = msg;

    if (!projectName) {
        if (projectID) {
            try {
                projectName = await getProjectNameByProjectID(projectID);
            } catch (err) {
                // Can't find a project name so log to the general logs using the project ID
                logInfo(`${projectID}: ${msg}`);
                return;
            }
        } else {
            // No project name or project ID so log to the general logs
            logInfo(msg);
            return;
        }
    }

    logger.clearContext();
    logger.addContext(contextName, projectName);
    logger.info(msg);
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
    if (previousProjectErrorLog === msg) {
        return;
    }

    previousProjectErrorLog = msg;
    if (!projectName) {
        if (projectID) {
            try {
                projectName = await getProjectNameByProjectID(projectID);
            } catch (err) {
                // Can't find a project name so log to the general logs using the project ID
                logError(`${projectID}: ${msg}`);
                return;
            }
        } else {
            // No project name or project ID so log to the general logs
            logError(msg);
            return;
        }
    }

    const trace = stackTrace.get();
    const logMsg = trace[1] ? chalk.red("[ File Name: " + trace[1].getFileName() + " | Function Name: " + trace[1].getFunctionName() + " | Line Number: " + trace[1].getLineNumber() + "] ") + msg : msg;

    logger.clearContext();
    logger.addContext(contextName, projectName);
    logger.error(logMsg);
}

/**
 * @function
 * @description Debug level logging for projects.
 *
 * @param msg <Required | String> - The message to be logged.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns void
 */
export async function logProjectDebug(msg: string, projectID: string): Promise<void> {
    if (process.env.NODE_ENV === "test") return;

    if (!msg) {
        console.log(chalk.red("Log error: A message must be provided"));
        return;
    }

    let projectName = "";
    if (projectID) {
        try {
            projectName = await getProjectNameByProjectID(projectID);
        } catch (err) {
            // Can't find a project name so log to the general logs using the project ID
            logDebug(`${projectID}: ${msg}`);
            return;
        }
    } else {
        // No project name or project ID so log to the general logs
        logDebug(msg);
        return;
    }

    logger.clearContext();
    logger.addContext(contextName, projectName);
    logger.debug(msg);
}

/**
 * @function
 * @description Trace level logging for projects.
 *
 * @param msg <Required | String> - The message to be logged.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns void
 */
export async function logProjectTrace(msg: string, projectID: string): Promise<void> {
    if (process.env.NODE_ENV === "test") return;

    if (!msg) {
        console.log(chalk.red("Log error: A message must be provided"));
        return;
    }

    let projectName = "";
    if (projectID) {
        try {
            projectName = await getProjectNameByProjectID(projectID);
        } catch (err) {
            // Can't find a project name so log to the general logs using the project ID
            logTrace(`${projectID}: ${msg}`);
            return;
        }
    } else {
        // No project name or project ID so log to the general logs
        logTrace(msg);
        return;
    }

    logger.clearContext();
    logger.addContext(contextName, projectName);
    logger.trace(msg);
}

/**
 * @function
 * @description Info level logging.
 *
 * @param msg <Required | String> - The message to be logged.
 *
 * @returns void
 */
export function logInfo(msg: string): void {
    if (process.env.NODE_ENV === "test") return;

    if (!msg) {
        console.log(chalk.red("Log error: A message must be provided"));
    }
    if (previousInfoLog === msg) {
        return;
    }

    previousInfoLog = msg;

    logger.clearContext();
    logger.addContext(contextName, "Turbine");
    logger.info(msg);
}

/**
 * @function
 * @description Error level logging.
 *
 * @param msg <Required | String> - The message to be logged.
 *
 * @returns void
 */
export function logError(msg: string): void {
    if (process.env.NODE_ENV === "test") return;

    if (!msg) {
        console.log(chalk.red("Log error: A message must be provided"));
    }
    if (previousErrorLog === msg) {
        return;
    }

    previousErrorLog = msg;
    const trace = stackTrace.get();
    const logMsg = trace[1] ? "[File Name: " + trace[1].getFileName() + " | Function Name: " + trace[1].getFunctionName() + " | Line Number: " + trace[1].getLineNumber() + "] " + msg : msg;

    logger.clearContext();
    logger.addContext(contextName, "Turbine");
    logger.error(logMsg);
}

/**
 * @function
 * @description Debug level logging.
 *
 * @param msg <Required | String> - The message to be logged.
 *
 * @returns void
 */
export function logDebug(msg: string): void {
    if (process.env.NODE_ENV === "test") return;

    if (!msg) {
        console.log(chalk.red("Log error: A message must be provided"));
    }

    logger.clearContext();
    logger.addContext(contextName, "Turbine");
    logger.debug(msg);
}

/**
 * @function
 * @description Trace level logging.
 *
 * @param msg <Required | String> - The message to be logged.
 *
 * @returns void
 */
export function logTrace(msg: string): void {
    if (process.env.NODE_ENV === "test") return;

    if (!msg) {
        console.log(chalk.red("Log error: A message must be provided"));
    }

    logger.clearContext();
    logger.addContext(contextName, "Turbine");
    logger.trace(msg);
}
