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

import { promisify } from "util";
import fs from "fs";
import path from "path";
import * as projectOperation from "../projects/operation";
import * as projectsController from "./projectsController";
import * as projectExtensions from "../extensions/projectExtensions";
import * as logger from "../utils/logger";
import * as statusController from "./projectStatusController";
import { UpdateProjectInfoPair, ProjectInfo } from "../projects/Project";
import * as projectSpecifications  from "../projects/projectSpecifications";
import AsyncLock from "async-lock";
import * as workspaceSettings from "../utils/workspaceSettings";
import * as utils from "../utils/utils";
const lock = new AsyncLock();

const fileStatAsync = promisify(fs.stat);

/**
 * @description
 * Map to save the timer for update operation for the current project
 * key: projectID
 * value: timer
 */
export const timerMap: Map<string, NodeJS.Timer> = new Map<string, NodeJS.Timer>();
export const changedFilesMap: Map<string, IFileChangeEvent[]> = new Map<string, IFileChangeEvent[]>();
export const chunkRemainingMap: Map <string, ChunkRemainingMapValue[]> = new Map<string, ChunkRemainingMapValue[]>();

const workspaceSettingsInfo =  workspaceSettings.workspaceSettingsInfoCache ? JSON.parse(workspaceSettings.workspaceSettingsInfoCache) : undefined;
// default 20s timeout to wait for all chunks
const timeout = (workspaceSettingsInfo && workspaceSettingsInfo.watcherChunkTimeout) ? workspaceSettingsInfo.watcherChunkTimeout : 20000;

/**
 * Determine if Codewind should handle a detected file change, or if it is handled by an extension
 *
 * @param detectChangeByExtension property from the project handler
 * @param path the path of detected file change
 */
function shouldHandle(detectChangeByExtension: boolean | string[], path: string): boolean {

    // detectChangeByExtension is not an array, treat it as a boolean
    // Codewind should handle if changes are *not* detected by the extension
    if (!Array.isArray(detectChangeByExtension)) {
        return !detectChangeByExtension;
    }

    // otherwise, detectChangeByExtension is an array
    // Codewind should handle only if the path is in the detectChangeByExtension array
    return detectChangeByExtension.includes(path);
}

/**
 * This is a function to receive notification from filewatcher daemon
 * @see [[Filewatcher.updateProjectForNewChange]]
 */
export async function updateProjectForNewChange(projectID: string, timestamp: number,  chunkNum: number, chunk_total: number, eventArray: IFileChangeEvent[]): Promise<IUpdateProjectSuccess | IUpdateProjectFailure> {
    if (!projectID || (timestamp === null || isNaN(timestamp)) || !eventArray || !chunkNum || !chunk_total) {
        return { "statusCode": 400, "error": {"msg": "Bad request. projectID, timestamp, chunk, chunk_total and eventArray are required." }};
    }

    try {
        logger.logProjectInfo("Project "  + projectID + " file changed" , projectID);
        const projectMetadata = projectsController.getProjectMetadataById(projectID);
        try {
            await fileStatAsync(projectMetadata.infoFile);
        } catch (err) {
            if (err.code == "ENOENT") {
                logger.logError("Project does not exist " + projectID);
                return { "statusCode": 404, "error": {"msg": "Project does not exist " + projectID }};
            }
        }

        const f = projectMetadata.infoFile;
        const projectInfo: ProjectInfo = await projectsController.getProjectInfoFromFile(f);
        await lock.acquire("timerLock", done => {
            if (timerMap.get(projectID) != undefined) {
                clearTimeout(timerMap.get(projectID));
            }
            done();
        }, () => {
            // timerLock release
        }, {});

        const eventArrayLength = eventArray.length;
        let isSettingFileChanged = false;
        let isProjectBuildRequired = false;

        const projectHandler = await projectExtensions.getProjectHandler(projectInfo);
        const detectChangeByExtension = projectHandler.detectChangeByExtension;
        try {
            for (let i = 0; i < eventArrayLength; i++) {
                if (isSettingFileChanged && isProjectBuildRequired) {
                    // Once we have all the necessary flags, dont process any more events
                    break;
                }
                if (eventArray[i].path &&
                    (eventArray[i].path.includes(".cw-settings") || eventArray[i].path.includes(".cw-refpaths.json")) &&
                    !isSettingFileChanged) {
                    isSettingFileChanged = true;
                } else if (eventArray[i].path && !eventArray[i].path.includes(".cw-settings") && shouldHandle(detectChangeByExtension, eventArray[i].path)) {
                    logger.logProjectInfo("Detected other file changes, Codewind will build the project", projectID);
                    isProjectBuildRequired = true;
                }
            }
            if (isSettingFileChanged) {
                logger.logProjectInfo("A Codewind settings file changed.", projectID);

                // first read .cw-settings file
                const settingsFilePath = path.join(projectInfo.location, ".cw-settings");
                const projectSettings = await utils.asyncReadJSONFile(settingsFilePath);
                delete projectSettings.refPaths; // this must come from the next file

                // then read .cw-refpaths.json file
                const refPathsFilePath = path.join(projectInfo.location, ".cw-refpaths.json");
                const refPathsFile = await utils.asyncReadJSONFile(refPathsFilePath);
                if (refPathsFile.refPaths) {
                    projectSettings.refPaths = refPathsFile.refPaths;
                }

                projectSpecifications.projectSpecificationHandler(projectID, projectSettings);
            }
        } catch (err) {
            // Log the error and Codewind will proceed to re-build the project
            isProjectBuildRequired = true;
            const msg = "Codewind was unable to determine if the .cw-settings file changed or a project build was required. Project will re-build.";
            logger.logProjectError(msg, projectID);
            logger.logProjectError(JSON.stringify(err), projectID);
        }

        if (!isProjectBuildRequired) {
            if (detectChangeByExtension) {
                logger.logProjectInfo("This project file changes will be ignored by Turbine. The project extension will decide if it needs to be rebuilt.", projectID);
            } else {
                // .cw-settings file is the only changed file. return succeed status
                logger.logProjectInfo("Only .cw-settings file change detected. Project will not re-build.", projectID);
            }
            return { "statusCode": 202 };
        }

        logger.logProjectInfo("File change detected. Project will re-build.", projectID);

        logger.logProjectInfo("Changed Files: " + generateChangeListSummaryForDebug(eventArray), projectID);

        await lock.acquire("changedFilesLock", done => {
            logger.logProjectTrace("Setting new changed files in the changedFilesMap... ", projectID);
            const oldChangedFiles: IFileChangeEvent[] = changedFilesMap.get(projectID);
            const newChangedFiles: IFileChangeEvent[] = oldChangedFiles ? oldChangedFiles.concat(eventArray) : eventArray;
            changedFilesMap.set(projectID, newChangedFiles);
            done();
        }, () => {
            // changedFilesLock release
        }, {});

        await lock.acquire(["chunkRemainingLock", "timerLock", "changedFilesLock"], async done => {
            let newChunkRemaining;
            if (chunk_total == 1) {
                newChunkRemaining = 0;
            } else {
                const chunkRemainingArray = chunkRemainingMap.get(projectID);
                if (chunkRemainingArray) {
                    let i;
                    for ( i = 0 ; i < chunkRemainingArray.length; i++) {
                        const chunkRemainingElement = chunkRemainingArray[i];
                        if (chunkRemainingElement.timestamp == timestamp) {
                            const oldchunkRemaining = chunkRemainingElement.chunkRemaining;
                            newChunkRemaining = oldchunkRemaining - 1;
                            if (newChunkRemaining == 0) {
                                chunkRemainingArray.splice(i, 1);
                            } else {
                                const value: ChunkRemainingMapValue = {
                                    timestamp: timestamp,
                                    chunkRemaining: newChunkRemaining
                                };
                                chunkRemainingArray[i] = value;
                                chunkRemainingMap.set(projectID, chunkRemainingArray);
                            }
                            break;
                        }
                    }
                    // first time initialize for this timestamp
                    if (chunkRemainingArray.length != 0 && i == chunkRemainingArray.length) {
                        const value: ChunkRemainingMapValue = {
                            timestamp: timestamp,
                            chunkRemaining: chunk_total - 1
                        };
                        chunkRemainingArray.push(value);
                        chunkRemainingMap.set(projectID, chunkRemainingArray);
                    }
                } else {
                    // first time initialize for this projectID
                    const tempArray = [];
                    const value: ChunkRemainingMapValue = {
                        timestamp: timestamp,
                        chunkRemaining: chunk_total - 1
                    };
                    tempArray.push(value);
                    chunkRemainingMap.set(projectID, tempArray);
                }
            }

            if (!projectInfo.autoBuildEnabled) {
                logger.logProjectInfo("Auto build disabled so build will not be started", projectID);
                statusController.buildRequired(projectID, true);
            }

            if (newChunkRemaining == 0) {
                // this is the last chunk for this timestamp, check if still waiting for other chunks for other timestamps
                logger.logProjectTrace("Received last chunk for timestamp " + timestamp + " , checking if still waiting for other chunks for other timestamps... ", projectID);
                let shouldTriggerBuild = true;
                if (chunkRemainingMap.size != 0) {
                    const chunkRemainingArray = chunkRemainingMap.get(projectID);
                    if (chunkRemainingArray && chunkRemainingArray.length > 0) {
                        // still waiting for some chunks
                        logger.logProjectTrace("Still waiting for other chunks... ", projectID);
                        shouldTriggerBuild = false;
                    }
                }
                if (shouldTriggerBuild) {
                    logger.logProjectInfo("Received all chunks", projectID);
                    if (projectInfo.autoBuildEnabled) {
                        logger.logProjectInfo("Proceeding the build... ", projectID);
                        if (!statusController.isBuildInProgressOrQueued(projectID)) {
                            const operation = new projectOperation.Operation("update", projectInfo);
                            projectHandler.update(operation, changedFilesMap.get(projectInfo.projectID));
                        } else {
                            logger.logProjectInfo("Project "  + projectID + " build is in progress, set build request flag to true", projectID);
                            const keyValuePair: UpdateProjectInfoPair = {
                                key : "buildRequest",
                                value: true,
                                saveIntoJsonFile: false
                            };
                            await projectsController.updateProjectInfo(projectID, keyValuePair);
                        }
                        // remove the cache in memory
                        changedFilesMap.delete(projectID);
                    }
                    timerMap.delete(projectID);
                    chunkRemainingMap.delete(projectID);
                    done();
                    return;
                }
            }

            const timer = setTimeout(async () => {
                logger.logProjectInfo("Timeout for waiting incomming chunks has been reached. ", projectID);
                try {
                    if (projectInfo.autoBuildEnabled) {
                        logger.logProjectInfo("Proceeding the build... ", projectID);
                        if (!statusController.isBuildInProgressOrQueued(projectID)) {
                            const operation = new projectOperation.Operation("update", projectInfo);
                            projectHandler.update(operation, changedFilesMap.get(projectInfo.projectID));
                        } else {
                            logger.logProjectInfo("Project "  + projectID + " build is in progress, set build request flag to true", projectID);
                            const keyValuePair: UpdateProjectInfoPair = {
                                key : "buildRequest",
                                value: true,
                                saveIntoJsonFile: false
                            };
                            await projectsController.updateProjectInfo(projectID, keyValuePair);
                        }
                        // remove the cache in memory
                        changedFilesMap.delete(projectID);
                    }
                    timerMap.delete(projectID);
                    chunkRemainingMap.delete(projectID);
                } catch (err) {
                    logger.logProjectError("Failed to set timeout for project update.", projectID);
                }
            }, timeout);
            timerMap.set(projectID, timer);
            done();
        }, () => {
            // all locks release
        }, {});
    } catch (err) {
        const errorMsg = "Internal error occurred when updating project " + projectID;
        logger.logProjectError(errorMsg, projectID);
        logger.logProjectError(err, projectID);
        return { "statusCode": 500, "error": {"msg": errorMsg }};
    }
    return { "statusCode": 202 };

}

function generateChangeListSummaryForDebug(entries: IFileChangeEvent[]): string {
    let result = "[ ";

    for (const entry of entries) {

        if (entry.type === "CREATE") {
            result += "+";
        } else if (entry.type === "MODIFY") {
            result += ">";
        } else if (entry.type === "DELETE") {
            result += "-";
        } else {
            result += "?";
        }

        let filename = entry.path;
        const index = filename.lastIndexOf("/");
        if (index !== -1) {
            filename = filename.substring(index + 1);
        }
        result += filename + " ";

        if (result.length > 256) {
            break;
        }
    }

    if (result.length > 256) {
        result += " (...) ";
    }
    result += "]";

    return result;

}

export interface IUpdateProjectSuccess {
    statusCode: 202;
}
export interface IUpdateProjectFailure {
    statusCode: 400 | 404| 500;
    error: { msg: string };
}

export interface IFileChangeEvent {
    path: string;
    timestamp: number;
    type: string;
    directory: boolean;
    content?: string;
}
export interface ChunkRemainingMapValue {
    timestamp: number;
    chunkRemaining: number;
}
