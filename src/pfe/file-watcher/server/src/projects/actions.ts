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
import { AppState } from "../controllers/projectStatusController";
import { StartModes } from "./constants";
import { ControlCommands } from "./constants";
import { Operation } from "./operation";
import { ProjectInfo, UpdateProjectInfoPair } from "./Project";
import { Validator } from "./Validator";
import * as logger from "../utils/logger";
import * as projectsController from "../controllers/projectsController";
import * as projectExtensions from "../extensions/projectExtensions";
import * as projectUtil from "./projectUtil";
import * as statusController from "../controllers/projectStatusController";
import * as utils from "../utils/utils";
import { IProjectActionParams } from "../controllers/projectsController";
import * as projectEventsController from "../controllers/projectEventsController";

export const actionMap = new Map<string, (args: any) => any>();
import AsyncLock from "async-lock";
const lock = new AsyncLock();

/**
 * @function
 * @description Validate a project.
 *
 * @param args <Required | Any> - Metadata args for a project.
 *
 * @returns Promise<{ operationId: string }>
 */
export const validate = async function(args: IProjectActionParams): Promise<{ operationId: string }> {
    const projectID = args.projectID;
    const projectType = args.projectType;
    const location = args.location;
    if (!projectType || !location) {
        const error = new Error("Validation requires a project type and location.");
        error.name = "BAD_REQUEST";
        throw error;
    }

    const projectInfo = {
        "projectType": projectType,
        "location": location
    } as ProjectInfo;
    const projectName = location.split("/").pop();
    if (args.extensionID) {
        projectInfo.extensionID = args.extensionID;
    }
    // Check whether the projectType exists
    const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
    if (!projectHandler || projectHandler.supportedType !== projectType) {
        const msg = "The project type " + projectType + " is not supported";
        logger.logProjectError(msg, projectID, projectName);
        const error = new Error(msg);
        error.name = "BAD_REQUEST";
        throw error;
    }

    // projectID is an optional parameter for validation. it may refer to a case where the project has not been created yet, e.g import case
    if (args.projectID) {
        projectInfo.projectID = args.projectID;
    }

    if (! await utils.asyncFileExists(location)) {
        const error = new Error("The provided location does not exist: " + location);
        error.name = "FILE_NOT_EXIST";
        throw error;
    }

    // Create operation
    const operation = new Operation("validate", projectInfo);

    logger.logProjectInfo("Validating project using operationId: " + operation.operationId, projectID, projectName);
    logger.logTrace(JSON.stringify(projectInfo));

    if (projectHandler.validate) {
        await projectHandler.validate(operation);
    } else {
        // if the project type doesn't support validation then just report success becauase validation is optional for project types
        const validator = new Validator(operation);
        validator.sendResult();
    }

    return { "operationId": operation.operationId };
};

/**
 * @function
 * @description Enable autobuild for a project.
 *
 * @param args <Required | Any> - Required arguments for enabling auto build.
 *
 * @returns Promise<{ status: string }>
 */
export const enableautobuild = async function (args: IProjectActionParams): Promise<{ status: string }> {
    if (!args.projectID) {
        const error = new Error("The project id was not provided");
        error.name = "BAD_REQUEST";
        throw error;
    }
    logger.logProjectInfo("Enabling auto build", args.projectID);
    const keyValuePair: UpdateProjectInfoPair = {
        key : "autoBuildEnabled",
        value: true,
        saveIntoJsonFile: true
    };
    const projectInfo = await projectsController.updateProjectInfo(args.projectID, keyValuePair);
    enableAndBuild(projectInfo);
    return { "status": "success"};
};

/**
 * @function
 * @description Enable autobuild for a project.
 *
 * @param projectInfo <Required | ProjectInfo> - Metadata information for a project.
 *
 * @returns Promise<void>
 */
async function enableAndBuild(projectInfo: ProjectInfo): Promise<void> {
    const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
    const projectID = projectInfo.projectID;
    const projectName = projectInfo.location.split("/").pop();

    if (projectHandler.hasOwnProperty("setAutoBuild")) {
        const operation = new Operation("enableautobuild", projectInfo);
        await projectHandler.setAutoBuild(operation);
    }
    if (statusController.isBuildRequired(projectInfo.projectID)) {
        logger.logProjectInfo("Build required is true on switch to auto build enabled so start or queue build", projectID, projectName);
        statusController.buildRequired(projectInfo.projectID, false);
        try {
            if (!statusController.isBuildInProgress(projectInfo.projectID)) {
                logger.logProjectInfo("Start build on switch to auto build enabled", projectID, projectName);
                const operation = new Operation("update", projectInfo);
                await statusController.updateProjectStatus(statusController.STATE_TYPES.buildState, projectID, statusController.BuildState.inProgress, "action.calculateDifference");
                const intervaltimer = setInterval(() => {
                    // wait till no expected incoming chunks in order to get a full fileChanged array
                    lock.acquire(["chunkRemainingLock", "changedFilesLock"], done => {
                        const chunkRemainingArray = projectEventsController.chunkRemainingMap.get(projectID);
                        if (chunkRemainingArray && chunkRemainingArray.length > 0) {
                            done();
                            return;
                        }
                        const changedFiles = projectEventsController.changedFilesMap.get(projectID);
                        projectHandler.update(operation, changedFiles);
                        projectEventsController.changedFilesMap.delete(projectID);
                        clearInterval(intervaltimer);
                        done();
                    }, () => {
                        // changedFilesLock release
                    }, {});
                }, 500);
            } else {
                logger.logProjectInfo("Build is in progress, set build request flag to true", projectID, projectName);
                const keyValuePair: UpdateProjectInfoPair = {
                    key : "buildRequest",
                    value: true,
                    saveIntoJsonFile: false
                };
                projectsController.updateProjectInfo(projectID, keyValuePair);
            }

        } catch (err) {
            logger.logProjectError(err, projectID, projectName);
        }
    }
}

/**
 * @function
 * @description Disable autobuild for a project.
 *
 * @param args <Required | Any> - Required arguments for disabling auto build.
 *
 * @returns Promise<{ status: string }>
 */
export const disableautobuild = async function (args: IProjectActionParams): Promise<{ status: string }> {
    if (!args.projectID) {
        const error = new Error("The project id was not provided");
        error.name = "BAD_REQUEST";
        throw error;
    }
    logger.logProjectInfo("Disabling auto build", args.projectID);
    const keyValuePair: UpdateProjectInfoPair = {
        key : "autoBuildEnabled",
        value: false,
        saveIntoJsonFile: true
    };
    const projectInfo = await projectsController.updateProjectInfo(args.projectID, keyValuePair);
    const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
    if (projectHandler.hasOwnProperty("setAutoBuild")) {
        const operation = new Operation("disableautobuild", projectInfo);
        projectHandler.setAutoBuild(operation);
    }
    return { "status": "success"};
};

/**
 * @function
 * @description Build a project.
 *
 * @param args <Required | Any> - Required arguments for building a project.
 *
 * @returns Promise<{ operationId: string }>
 */
export const build = async function (args: IProjectActionParams): Promise<{ operationId: string }> {
    if (!args.projectID) {
        const error = new Error("The project id was not provided");
        error.name = "BAD_REQUEST";
        throw error;
    }
    const projectInfo = await projectUtil.getProjectInfo(args.projectID);
    if (!projectInfo) {
        const error = new Error("No project found for project id: " + args.projectID);
        error.name = "FILE_NOT_EXIST";
        throw error;
    }
    if (!statusController.isBuildInProgress(args.projectID)) {
        await statusController.updateProjectStatus(statusController.STATE_TYPES.buildState, args.projectID, statusController.BuildState.inProgress, "action.calculateDifference");
        const operation = new Operation("update", projectInfo);
        const intervaltimer = setInterval(() => {
            // wait till no expected incoming chunks in order to get a full fileChanged array
            lock.acquire(["chunkRemainingLock", "changedFilesLock"], async done => {
                const chunkRemainingArray = projectEventsController.chunkRemainingMap.get(args.projectID);
                if (chunkRemainingArray && chunkRemainingArray.length > 0) {
                    done();
                    return;
                }
                const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
                projectInfo.forceAction = "REBUILD";
                const changedFiles = projectEventsController.changedFilesMap.get(args.projectID);
                projectHandler.update(operation, changedFiles);
                statusController.buildRequired(args.projectID, false);
                // delete cache from the map, since a build is triggerred
                projectEventsController.changedFilesMap.delete(args.projectID);
                clearInterval(intervaltimer);
                done();
            }, () => {
                // changedFilesLock release
            }, {});
        }, 500);

        return { "operationId": operation.operationId };
    } else {
        throw new Error("A build is already in progress");
    }
};

/**
 * @function
 * @description Restart a project.
 *
 * @param args <Required | Any> - Required arguments for restaring a build.
 *
 * @returns Promise<{ operationId: string }>
 */
export const restart = async function(args: IProjectActionParams): Promise<{ operationId: string }> {
    if (!args.projectID) {
        const error = new Error("The project id was not provided");
        error.name = "BAD_REQUEST";
        throw error;
    }
    logger.logProjectInfo(`Request to restart project in ${args.startMode} mode`, args.projectID);

    if (!args.startMode) {
        const error = new Error(`The startMode was not provided`);
        error.name = "BAD_REQUEST";
        throw error;
    }
    if (!(args.startMode in StartModes)) {
        const error = new Error(`The startMode "${args.startMode}" is not recognized`);
        error.name = "BAD_REQUEST";
        throw error;
    }
    if (process.env.IN_K8 === "true") {
        const error = new Error("Restart is not supported for Kubernetes");
        error.name = "BAD_REQUEST";
        throw error;
    }
    const projectInfo = await projectUtil.getProjectInfo(args.projectID);
    if (!projectInfo) {
        const error = new Error("No project found for project id: " + args.projectID);
        error.name = "FILE_NOT_EXIST";
        throw error;
    }
    const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
    const capabilities = projectExtensions.getProjectCapabilities(projectHandler);

    // Validate all we require for a restart
    // - the project supports being restarted in the given mode
    // - the project is not building
    // - the project is Started (this may change)
    if (!capabilities.hasControlCommand(ControlCommands.restart) ||
        !projectHandler.hasOwnProperty("stop") || !projectHandler.hasOwnProperty("start")) {

        const friendlyType: string = projectUtil.getUserFriendlyProjectType(projectInfo.projectType);
        const error = new Error(`${friendlyType} projects cannot be restarted.`);
        error.name = "BAD_REQUEST";
        throw error;
    }
    if (!capabilities.hasStartMode(args.startMode)) {
        const friendlyType: string = projectUtil.getUserFriendlyProjectType(projectInfo.projectType);
        const error = new Error(`${friendlyType} projects do not support restarting in ${args.startMode} mode.`);
        error.name = "BAD_REQUEST";
        throw error;
    }
    if (statusController.isBuildInProgress(args.projectID)) {
        const error = new Error("Restart is invalid when the project is building.");
        error.name = "BAD_REQUEST";
        throw error;
    }
    const appState: AppState = statusController.getAppState(args.projectID);
    if (appState !== AppState.starting && appState !== AppState.started) {
        const error = new Error("Restart is valid only when project is starting or started.");
        error.name = "BAD_REQUEST";
        throw error;
    }

    // By this point, we know that the restart operation can proceed.

    const operation = new Operation("", projectInfo);

    projectUtil.restartProject(operation, args.startMode, "projectRestartResult");

    return { "operationId": operation.operationId };
};


actionMap.set("validate", validate);
actionMap.set("enableautobuild", enableautobuild);
actionMap.set("disableautobuild", disableautobuild);
actionMap.set("build", build);
actionMap.set("restart", restart);
