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

import * as io from "../utils/socket";
import * as projectUtil from "../projects/projectUtil";
import * as logger from "../utils/logger";
import * as locale from "../utils/locale";
import { actionMap } from "../projects/actions";
import { ContainerStates } from "../projects/constants";
import { ProjectInfo } from "../projects/Project";

export enum STATE_TYPES {
    appState = "appState",
    buildState = "buildState"
}

// App state constants
export enum AppState {
    starting = "starting",
    started = "started",
    stopping = "stopping",
    stopped = "stopped",
    unknown = "unknown"
}

// Build state constants
export enum BuildState {
    inProgress = "inProgress",
    success = "success",
    failed = "failed",
    unknown = "unknown",
    queued = "queued"
}

export const appStateMap = new Map();
const buildStateMap = new Map();
const buildRequiredMap = new Map();

const pingInterval = 10000;
const inTransitPingInterval = 2000;

// Keep track of project status.  The type parameter is used to determine the type of the status
// such as application state or build status.

/**
 * @class
 * @description The class representing the project states.
 */
class ProjectState {
    state: any;
    msg: string;
    lastbuild?: number;
    appImageLastBuild?: string;
    buildImageLastBuild?: string;
    detailedAppStatus?: string;

    /**
     * @constructor
     * @description Constructor for the project state class.
     *
     * @param state <Required | Any> - The initial state of the project.
     * @param msg <Required | String> - The message of the initial state.
     * @param lastbuild <Optional | Number> - The timestamp of the last build.
     * @param appImageLastBuild <Optional | String> - The last app image info.
     * @param buildImageLastBuild <Optional | String> - The last build image info.
     * @param detailedAppStatus <Optional | String> - The detailed app status to update.
     */
    constructor(state: any, msg: string, lastbuild?: number, appImageLastBuild?: string, buildImageLastBuild?: string, detailedAppStatus?: string) {
        this.state = state;
        this.msg = msg;
        if (lastbuild)
            this.lastbuild = lastbuild;
        if (appImageLastBuild)
            this.appImageLastBuild = appImageLastBuild;
        if (buildImageLastBuild)
            this.buildImageLastBuild = buildImageLastBuild;
        if (detailedAppStatus)
            this.detailedAppStatus = detailedAppStatus;
    }

    /**
     * @function
     * @description Check to see if the project state has a message.
     *
     * @returns boolean
     */
    hasMsg(): boolean {
        if (this.msg) {
            return true;
        }
        return false;
    }
}

logger.logFileWatcherInfo("Initialize application state map");
initAppStateMap();
logger.logFileWatcherInfo("Initialize build state map");
initBuildStateMap();
projectUtil.setprojectList();
logger.logFileWatcherInfo("Starting application ping intervals");

setInterval(pingApplications, pingInterval);
setInterval(pingInTransitApplications, inTransitPingInterval);

/**
 * @function
 * @description Provide the latest status for a project and status type.
 *
 * @param type <Required | String> - The status type. Supported types include: 'appState' and 'buildState'.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns Promise<{data: {}}>
 */
export async function getProjectStatus(type: string, projectID: string): Promise<{data: {}}> {

    const response: any = {};

    if (type == STATE_TYPES.appState) {
        const appState: ProjectState = appStateMap.get(projectID);
        const data: any = {
            appStatus: appState.state
        };
        if (appState.hasMsg()) {
           data.appErrorStatus = await locale.getTranslation(appState.msg);
        }
        if (appState.detailedAppStatus) {
           data.detailedAppStatus = appState.detailedAppStatus;
        }
        response.data = data;
        return response;
    } else if (type == STATE_TYPES.buildState) {
        const buildState: ProjectState = buildStateMap.get(projectID);
        let buildRequired = false;
        if (buildRequiredMap.get(projectID)) {
            buildRequired = buildRequiredMap.get(projectID);
        }
        const data: any = {
            buildStatus: buildState.state,
            buildRequired: buildRequired
        };
        if (buildState.hasMsg()) {
            data.detailedBuildStatus = await locale.getTranslation(buildState.msg);
        }
        if (buildState.lastbuild) {
            data.lastbuild = buildState.lastbuild;
        }
        response.data = data;
        return response;
    } else {
        logger.logProjectError("Unrecognized status type: " + type, projectID);
        throw new Error("Unrecognized type: " + type);
    }
}

/**
 * @see [[Filewatcher.updateStatus]]
 */
export async function updateStatus(req: IUpdateStatusParams): Promise<IUpdateStatusSuccess | IUpdateStatusFailure> {
    if (!req.type) {
        return { "statusCode": 400, "error": { "msg": "Missing required status type parameter"}};
    }
    const type: string = req.type;

    if (type == STATE_TYPES.appState) {
        if (!req.projectID || !req.status) {
            return { "statusCode": 400, "error": { "msg": "Missing request parameters projectID or status for application state update"}};
        }

        const projectID: string = req.projectID;
        const newState: any = req.status;
        const error: string = req.error;

        if (! (newState in AppState)) {
            return { "statusCode": 400, "error": { "msg": "Invalid application state: " + newState}};
        }

        try {
            await updateProjectStatus(type, projectID, newState, error);
            return { "statusCode": 200};
        } catch (err) {
            return { "statusCode": 400, "error": { "msg": "Error updating project status: " + type}};
        }

    } else if (type == STATE_TYPES.buildState) {
        if (!req.projectID || !req.buildStatus) {
            return { "statusCode": 400, "error": { "msg": "Missing request parameters projectID or status for build state update"}};
        }

        const projectID: string = req.projectID;
        const newState: any = req.buildStatus;
        const newDetailedState: string = req.detailedBuildStatus;
        const appImageLastBuild: string = req.appImageLastBuild;
        const buildImageLastBuild: string = req.buildImageLastBuild;

        if (! (newState in BuildState)) {
            return { "statusCode": 400, "error": { "msg": "Invalid build state: " + newState}};
        }

        try {
            await updateProjectStatus(type, projectID, newState, newDetailedState, appImageLastBuild, buildImageLastBuild);
            return { "statusCode": 200};
        } catch (err) {
            return { "statusCode": 400, "error": { "msg": "Error updating project status: " + type}};
        }

    } else {
        return { "statusCode": 400, "error": { "msg": "Unrecognized status type: " + type}};
    }
}

/**
 * @function
 * @description Update the status for a project and status type.
 *
 * @param type <Required | String> - The status type. Supported types include: 'appState' and 'buildState'.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param status <Required | String> - The states for appState and buildState.
 * @param detailedAppStatus <Optional | String> - The detailed app status to update.
 * @param msg <Required | String> - The new message to update.
 * @param appImageLastBuild <Optional | String> - The last app image timestamp.
 * @param buildImageLastBuild <Optional | String> - The last build image timestamp.
 * @param translatedMsg <Optional | String> - The translated new message.
 *
 * @returns Promise<void>
 */
export async function updateProjectStatus(type: string, projectID: string, status: string, msg: string, appImageLastBuild?: string, buildImageLastBuild?: string, translatedMsg?: string, detailedAppStatus?: string): Promise<void> {

    if (type == STATE_TYPES.appState) {

        const newState: string = status;
        const newError = msg;
        const newDetailedState = detailedAppStatus;
        let oldState: AppState = AppState.unknown;
        let oldError = AppState.unknown;
        let oldDetailedState = AppState.unknown;

        if (appStateMap.has(projectID)) {
            oldState = appStateMap.get(projectID).state;
            oldDetailedState = appStateMap.get(projectID).detailedAppStatus;
            oldError = appStateMap.get(projectID).msg;
        }
        // Only update if the state or message has changed. Also protect against changing from stopped state to stopping.
        if ((newState != oldState || newDetailedState != oldDetailedState || newError != oldError) && !(oldState == AppState.stopped && newState == AppState.stopping)) {
            logger.logProjectInfo("Application state changed for project: " + projectID + " from: " + oldState + ", to: " + newState + (newDetailedState ? ", with message: " + newDetailedState : ""), projectID);
            appStateMap.set(projectID, new ProjectState(newState, newError, undefined, undefined, undefined, newDetailedState));

            const data: any = {
                projectID: projectID,
                appStatus: newState
            };

            if (translatedMsg) {
                data.appErrorStatus = translatedMsg;
            }

            else if (newError) {
                data.appErrorStatus = (newError == " ") ? newError : await locale.getTranslation(newError);
            }

            if (detailedAppStatus) {
                data.detailedAppStatus = detailedAppStatus;
            }
            io.emitOnListener("projectStatusChanged", data);
        }
    } else if (type == STATE_TYPES.buildState) {

        const newState: string = status;
        const newDetailedState = msg;
        let oldState = BuildState.unknown;
        let oldDetailedState = BuildState.unknown;

        if (buildStateMap.has(projectID)) {
            oldState = buildStateMap.get(projectID).state;
            oldDetailedState = buildStateMap.get(projectID).msg;
        }

        // Update the build state unless the build state & detailedBuildState are both the same
        if (newState != oldState || newDetailedState != oldDetailedState) {
            logger.logProjectInfo("Build state changed for project: " + projectID + " from: " + oldState + ", to: " + newState + (newDetailedState ? ", with message: " + newDetailedState : ""), projectID);
            let timestamp;
            if (newState === BuildState.success || newState === BuildState.failed) {
                timestamp = Date.now();
            }
            const data: any = {
                projectID: projectID,
                buildStatus: newState
            };
            if (translatedMsg) {
                data.detailedBuildStatus = translatedMsg;
            }
            else if (newDetailedState) {
                data.detailedBuildStatus = (newDetailedState == " ") ? newDetailedState : await locale.getTranslation(newDetailedState);
            }
            if (timestamp) {
                data.lastbuild = timestamp;
            }
            if (appImageLastBuild) {
                data.appImageLastBuild = appImageLastBuild;
            }
            if (buildImageLastBuild) {
                data.buildImageLastBuild = buildImageLastBuild;
            }
            buildStateMap.set(projectID, new ProjectState(newState, newDetailedState, timestamp, appImageLastBuild, buildImageLastBuild));
            io.emitOnListener("projectStatusChanged", data);

            // Trigger project validation after every build
            if (newState === BuildState.success || newState === BuildState.failed) {
                try {
                    const projectInfo = await projectUtil.getProjectInfo(projectID);

                    if (projectInfo && projectInfo.location && projectInfo.projectType) {
                        logger.logProjectInfo("Kicking off validation for project: " + projectID, projectID);
                        await actionMap.get("validate")({
                            projectID: projectID,
                            location: projectInfo.location,
                            projectType: projectInfo.projectType
                        });
                    } else {
                        logger.logProjectError("Project validation could not be kicked off for project: " + projectID, projectID);
                        logger.logProjectError("Project info: " + JSON.stringify(projectInfo, undefined, 2), projectID);
                    }
                } catch (err) {
                    logger.logProjectError("Project validation could not be kicked off for project " + projectID + " due to an internal failure.", projectID);
                    logger.logProjectError(err, projectID);
                }
            }
        }
    } else {
        logger.logProjectError("Unrecognized type: " + type, projectID);
        throw new Error("Unrecognized type: " + type);
    }
}

/**
 * @function
 * @description Add a project to the state tracking.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns void
 */
export function addProject(projectID: string): void {
    if (!buildStateMap.has(projectID)) {
        buildStateMap.set(projectID, new ProjectState(BuildState.unknown, undefined));
    }
    if (!buildRequiredMap.has(projectID)) {
        buildRequiredMap.set(projectID, new ProjectState(false, undefined));
    }
    if (!appStateMap.has(projectID)) {
        appStateMap.set(projectID, new ProjectState(AppState.unknown, undefined));
    }
}

/**
 * @function
 * @description Remove a project to the state tracking.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns void
 */
export function deleteProject(projectID: string): void {
    appStateMap.delete(projectID);
    buildStateMap.delete(projectID);
    buildRequiredMap.delete(projectID);
}

/**
 * @function
 * @description Initialize the app status tracker.
 *
 * @returns void
 */
function initAppStateMap(): void {
    projectUtil.getAllProjectInfo((projectInfo: ProjectInfo) => {
        if (projectInfo.projectID) {
            logger.logProjectInfo("Initialize application state map for project: " + projectInfo.projectID, projectInfo.projectID);
            appStateMap.set(projectInfo.projectID, new ProjectState(AppState.unknown, undefined));
        }
    });
}

/**
 * @function
 * @description Initialize the build status tracker.
 *
 * @returns void
 */
function initBuildStateMap(): void {
    projectUtil.getAllProjectInfo((projectInfo: ProjectInfo) => {
        if (projectInfo.projectID) {
            logger.logProjectInfo("Initialize build state map for project: " + projectInfo.projectID, projectInfo.projectID);
            buildStateMap.set(projectInfo.projectID, new ProjectState(BuildState.unknown, "projectStatusController.buildStateMap"));
            buildRequiredMap.set(projectInfo.projectID, new ProjectState(false, undefined));

            // Emit the initialized state (set to unknown) over the socket
            const data = {
                projectID: projectInfo.projectID,
                buildStatus: BuildState.unknown,
                buildRequired: false,
                detailedBuildStatus: "projectStatusController.projectInfoError"
            };
            io.emitOnListener("projectStatusInit", data);
        }
    });

}

/**
 * @function
 * @description Ping started and stopped applications to check if their state has changed.
 *
 * @returns void
 */
function pingApplications(): void {
    appStateMap.forEach((stateObj, projectID) => {
        const currentState = stateObj.state;
        if (currentState === AppState.started || currentState === AppState.stopped || currentState === AppState.unknown) {
            projectUtil.isApplicationUp(projectID, (stateInfo: any) => {
                if (appStateMap.get(projectID)) {
                    const oldState = appStateMap.get(projectID).state;
                    if (oldState !== AppState.started && oldState !== AppState.stopped && oldState !== AppState.unknown) {
                        return;
                    }
                    const oldMsg = appStateMap.get(projectID).msg;
                    let newState = oldState;
                    let newMsg = stateInfo.error;
                    if (newMsg) { newMsg = newMsg.toString(); } // Convert from Error to string
                    if (stateInfo.hasOwnProperty("isAppUp")) {
                        newState = stateInfo.isAppUp ? AppState.started : AppState.stopped;
                    } else if (newMsg) {
                        newState = AppState.stopped;
                    }
                    appStateMap.set(projectID, new ProjectState(newState, newMsg));

                    // Ensure that only new messages are logged
                    if (newMsg && (newMsg.toString() !== (oldMsg ? oldMsg.toString() : oldMsg))) {
                        logger.logProjectInfo("pingApplications: Application state error message: " + newMsg, projectID);
                    }

                    // Update the state only if it has changed
                    if (newState != oldState) {
                        logger.logProjectInfo("pingApplications: Application state for project " + projectID + " has changed from " + oldState + " to " + newState, projectID);
                        const data: any = {
                            projectID: projectID,
                            appStatus: newState
                        };
                        io.emitOnListener("projectStatusChanged", data);
                    }
                }
            });
        }
    });
}

/**
 * @function
 * @description Ping applications that are starting or stopping to check if they have reached the final state.
 *
 * @returns void
 */
function pingInTransitApplications(): void {
    appStateMap.forEach((stateObj, projectID) => {
        const currentState = stateObj.state;
        if (currentState === AppState.starting || currentState === AppState.stopping) {
            projectUtil.isContainerActive(projectID, (containerStatus: any) => {
                if (containerStatus.hasOwnProperty("state")) {
                    if (containerStatus.state === ContainerStates.containerActive) {
                        // The container is running so try pinging the application
                        projectUtil.isApplicationUp(projectID, async (stateInfo: any) => {
                            const projectInfo = await projectUtil.getProjectInfo(projectID);

                            if (appStateMap.get(projectID)) {
                                const oldState = appStateMap.get(projectID).state;
                                if (oldState !== AppState.starting && oldState !== AppState.stopping) {
                                    return;
                                }
                                const oldMsg = appStateMap.get(projectID).msg;
                                let newState = oldState;
                                let newMsg = stateInfo.error;
                                if (newMsg) { newMsg = newMsg.toString(); } // Convert from Error to string
                                if (stateInfo.hasOwnProperty("isAppUp")) {
                                    if (oldState === AppState.starting && stateInfo.isAppUp) {
                                        newState = (stateInfo.isAppUp && projectInfo.sentProjectInfo) ? AppState.started : oldState;
                                    } else if (oldState === AppState.stopping && !stateInfo.isAppUp) {
                                        newState = AppState.stopped;
                                    }
                                } else if (oldState === AppState.stopping && newMsg) {
                                    newState = AppState.stopped;
                                }
                                const detailedAppStatus = appStateMap.get(projectID).detailedAppStatus;
                                appStateMap.set(projectID, new ProjectState(newState, newMsg, undefined, undefined, undefined, detailedAppStatus));

                                // Ensure that only new messages are logged
                                if (newMsg && (newMsg.toString() !== (oldMsg ? oldMsg.toString() : oldMsg))) {
                                    logger.logProjectInfo("pingInTransitApplications: Application state error message: " + newMsg, projectID);
                                }

                                // Update the state only if it has changed
                                if (newState !== oldState) {
                                    logger.logProjectInfo("pingInTransitApplications: Application state for project " + projectID + " has changed from " + oldState + " to " + newState, projectID);
                                    const data = {
                                        projectID: projectID,
                                        appStatus: newState
                                    };
                                    io.emitOnListener("projectStatusChanged", data);
                                }
                            }
                        });
                    } else if (containerStatus.state === ContainerStates.containerStarting) {
                        // Just ignore this state and wait until the container reaches a final state
                    } else if (containerStatus.state === ContainerStates.containerStopped) {
                        // The container is stopped so change the application state to stopped
                        if (appStateMap.get(projectID)) {
                            const oldState = appStateMap.get(projectID).state;
                            if (oldState !== AppState.starting && oldState !== AppState.stopping) {
                                return;
                            }
                            logger.logProjectInfo("pingInTransitApplications: Application state for project " + projectID + " has changed from " + oldState + " to " + AppState.stopped, projectID);
                            const data: any = {
                                projectID: projectID,
                                appStatus: AppState.stopped
                            };
                            if (oldState === AppState.starting) {
                                // If the container stopped while the application was starting up then something went wrong
                                data.appErrorStatus = "projectStatusController.appStatusContainerStopped";
                                const detailedAppStatus = appStateMap.get(projectID).detailedAppStatus;
                                appStateMap.set(projectID, new ProjectState(AppState.stopped, data.appErrorStatus, undefined, undefined, undefined, detailedAppStatus));
                            } else {
                                appStateMap.set(projectID, new ProjectState(AppState.stopped, undefined));
                            }
                            io.emitOnListener("projectStatusChanged", data);
                        }
                    } else if (containerStatus.state === ContainerStates.containerNotFound) {
                            // If app is starting then just assume the container is not created yet, but
                            // if the app is stopping change it to stopped state
                            if (appStateMap.get(projectID) && appStateMap.get(projectID).state === AppState.stopping) {
                                logger.logProjectInfo("pingInTransitApplications: Application state for project " + projectID + " has changed from " + AppState.stopping + " to " + AppState.stopped, projectID);
                                appStateMap.set(projectID, new ProjectState(AppState.stopped, undefined));
                                const data = {
                                    projectID: projectID,
                                    appStatus: AppState.stopped
                                };
                                io.emitOnListener("projectStatusChanged", data);
                            }
                    }
                } else if (containerStatus.hasOwnProperty("error")) {
                    if (appStateMap.get(projectID)) {
                        const oldState = appStateMap.get(projectID).state;
                        if (oldState !== AppState.starting && oldState !== AppState.stopping) {
                            return;
                        }
                        const oldMsg = appStateMap.get(projectID).msg;
                        let newMsg = containerStatus.error;
                        if (newMsg) { newMsg = newMsg.toString(); } // Convert from Error to string
                        const detailedAppStatus = appStateMap.get(projectID).detailedAppStatus;
                        appStateMap.set(projectID, new ProjectState(oldState, newMsg, undefined, undefined, undefined, detailedAppStatus));

                        // Ensure that only new messages are logged
                        if (newMsg && (newMsg.toString() !== (oldMsg ? oldMsg.toString() : oldMsg))) {
                            logger.logProjectInfo("pingInTransitApplications: Application state error message: " + newMsg, projectID);
                        }
                    }
                }
            });
        }
    });
}

/**
 * @function
 * @description Check to see if a project build is in progress.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns boolean
 */
export function isBuildInProgress(projectID: string): boolean {
    if (buildStateMap.has(projectID) && buildStateMap.get(projectID).state == BuildState.inProgress)
        return true;
    else
        return false;
}

/**
 * @function
 * @description Check to see if a project build is required, and set the build require to the value.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param value <Required | Boolean> - A truth value to specify the build state switch.
 *
 * @returns Promise<void>
 */
export async function buildRequired(projectID: string, value: boolean): Promise<void> {
    let oldBuildRequired;
    if (buildRequiredMap.get(projectID)) {
        oldBuildRequired = buildRequiredMap.get(projectID);
    }
    if (oldBuildRequired !== value) {
        logger.logProjectInfo("Updating project build required state to " + value, projectID);
        buildRequiredMap.set(projectID, new ProjectState(value, undefined));
        const data: any = {
            projectID: projectID,
            buildRequired: value
        };
        io.emitOnListener("projectStatusChanged", data);
    }
}

/**
 * @function
 * @description Check to see if a project build is required.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns boolean
 */
export function isBuildRequired(projectID: string): boolean {
    if (buildRequiredMap.get(projectID)) {
        return buildRequiredMap.get(projectID).state;
    }
    return false;
}

/**
 * @function
 * @description Get the app state of a project.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns AppState
 */
export function getAppState(projectID: string): AppState {
    if (!appStateMap.has(projectID)) {
        return AppState.unknown;
    }

    const appState = appStateMap.get(projectID);
    return (<any>AppState)[appState.state];
}

/**
 * @function
 * @description Get the build state of a project.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 *
 * @returns BuildState
 */
export function getBuildState(projectID: string): BuildState {
    if (!buildStateMap.has(projectID)) {
        return BuildState.unknown;
    }

    const buildState = buildStateMap.get(projectID);
    return (<any>BuildState)[buildState.state];
}

/**
 * @function
 * @description Wait to recieve the application state for a project.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param appState <Required | AppState> - The states for appState.
 * @param callback <Required | Function> - The callback function to return the appstate.
 *
 * @returns Promise<void>
 */
export async function waitForApplicationState(projectID: string, appState: AppState, callback: (err: string, appState: AppState) => void): Promise<void> {
    const interval = setInterval(() => {
        if (getAppState(projectID) === appState) {
            clearInterval(interval);
            callback(undefined, appState);
        }
    }, inTransitPingInterval);
}



export interface IUpdateStatusParams {
    projectID: string;
    type: string;
    status?: string;
    error?: string;
    buildStatus?: string;
    detailedBuildStatus?: string;
    appImageLastBuild?: string;
    buildImageLastBuild?: string;
}

export interface IUpdateStatusSuccess {
    statusCode: 200;
}

export interface IUpdateStatusFailure {
    statusCode: 400 | 404;
    error: { msg: string };
}