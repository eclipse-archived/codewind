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
import { StartModes, ControlCommands } from "./constants";

export interface ProjectInfo {

    [key: string]: any;

    projectID: string;
    projectType: string;
    location: string;
    autoBuildEnabled: boolean;
    contextRoot?: string;
    healthCheck?: string;
    appPorts?: Array<string>;
    debugPort?: string;
    buildRequest?: boolean;
    sentProjectInfo?: boolean;
    forceAction?: string;
    startMode: string;
    mavenProfiles?: string[];
    mavenProperties?: string[];
    ignoredPaths?: string[];
    extensionID?: string;
    language?: string;
    isHttps?: boolean;
    appBaseURL?: string;
    compositeAppName?: string;
    statusPingTimeout?: number;
}

export interface ProjectMetadata {
    dir: string;
    infoFile: string;
    logDir: string;
    logFile: string;
}

export interface AppLog {
    origin: string;
    files: string[];
    dirs?: string[];
    bestTime?: number;
    containerName?: string;
    podName?: string;
}

export interface BuildLog {
    origin: string;
    files: string[];
    dirs?: string[];
    bestTime?: number;
    containerName?: string;
    podName?: string;
}

export interface BuildRequest {
    projectLocation: string;
    LOCAL_WORKSPACE: string;
    projectID: string;
    containerName: string;
    autoBuildEnabled: boolean;
    logName: string;
    containerPorts: string[];
    hostPorts: string[];
}

export interface UpdateProjectInfoPair {
    key: string;
    value: any;
    saveIntoJsonFile?: boolean;
}

export interface ProjectSettingsEvent {
    operationId: String;
    projectID: String;
    status: String;
    ports?: {
        exposedPort?: string;
        internalPort?: string;
        internalDebugPort?: string;
    };
    error?: String;
    contextRoot?: String;
    healthCheck?: string;
    ignoredPaths?: string[];
    mavenProfiles?: string[];
    mavenProperties?: string[];
    isHttps?: boolean;
    statusPingTimeout?: number;
}

/**
 * @class
 * @description The class representing project capabilities.
 */
export class ProjectCapabilities {
    startModes: StartModes[];
    controlCommands: ControlCommands[];

    /**
     * @constructor
     * @description Constructor for the ProjectCapabilities class.
     *
     * @param startModes <Required | StartModes[]> - Array of start modes.
     * @param controlCommands <Required | ControlCommands[]> - Array of control commands.
     */
    constructor(startModes: StartModes[], controlCommands: ControlCommands[]) {
        if (startModes) {
            this.startModes = startModes;
        }
        if (controlCommands) {
            this.controlCommands = controlCommands;
        }
    }

    /**
     * @function
     * @description Check if any of the modes given are start modes.
     *
     * @param startMode <Required | StartModes> - The start modes to iterate through.
     *
     * @returns boolean
     */
    hasStartMode(startMode: String): boolean {
        for (const mode of this.startModes) {
            if (startMode === mode) {
                return true;
            }
        }
        return false;
    }

    /**
     * @function
     * @description Check if any of the commands given are control commands.
     *
     * @param controlCommand <Required | String> = The control commands to iterate through.
     *
     * @returns boolean
     */
    hasControlCommand(controlCommand: String): boolean {
        for (const command of this.controlCommands) {
            if (controlCommand === command) {
                return true;
            }
        }
        return false;
    }

    /**
     * @function
     * @description Get an object containing the capabilities.
     *
     * @returns { capabilities: ProjectCapabilities }
     */
    getResponseObject(): { capabilities: ProjectCapabilities } {
        const capabilities = {capabilities: this};
        return capabilities;
    }
}

export const defaultProjectCapabilities: ProjectCapabilities = new ProjectCapabilities([StartModes.run], []);