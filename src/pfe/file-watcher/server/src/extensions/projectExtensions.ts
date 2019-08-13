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

import * as path from "path";

import * as logger from "../utils/logger";
import * as utils from "../utils/utils";

// built-in project extensions
import * as libertyProject from "../projects/libertyProject";
import * as springProject from "../projects/springProject";
import * as swiftProject from "../projects/swiftProject";
import * as nodeProject from "../projects/nodejsProject";
import { DockerProject } from "../projects/DockerProject";
import { ShellExtensionProject } from "../projects/ShellExtensionProject";
import { ProjectInfo, ProjectCapabilities, defaultProjectCapabilities } from "../projects/Project";
import { workspaceConstants } from "../projects/constants";

export const DOCKER_TYPE = "docker";

export const projectHandlers = [libertyProject, springProject, swiftProject, nodeProject];
const extensionProjectHandlers: { [key: string]: any; } = {};

const projectExtensionList: string[] = [];

/**
 * @function
 * @description Check to see if a project extension is supported.
 *
 * @param projectType <Required | String> - The project type.
 *
 * @returns boolean
 */
export function isProjectExtensionSupported(projectType: string): boolean {
    const isExtensionSupported = projectExtensionList.includes(projectType);
    return isExtensionSupported;
}

/**
 * @function
 * @description Add the project type to the project extension list.
 *
 * @param projectType <Required | String> - The project type.
 *
 * @returns void
 */
export function setProjectExtensionList(projectType: string): void {
    projectExtensionList.push(projectType);
    logger.logInfo("projectExtensionList has been updated with extension type " + projectType + ": " + projectExtensionList);
}

/**
 * @function
 * @description Remove the project type from the project extension list.
 *
 * @param projectType <Required | String> - The project type.
 *
 * @returns void
 */
export function removeProjectExtensionList(projectType: string): void {
    projectExtensionList.splice(projectExtensionList.indexOf(projectType), 1);
    logger.logInfo("Extension type " + projectType + " has been removed from projectExtensionList: " + projectExtensionList);
}

/**
 * @function
 * @description Get list of project types.
 *
 * @param location <Required | String> - The folder location to scan.
 *
 * @returns Promise<Array<string>>
 */
export async function getProjectTypes(location: string): Promise<Array<string>> {

    let types: Array<string> = [];

    // If no project location is specified then return all known types
    if (!location) {
        return getAllProjectTypes();
    }

    types = await determineProjectType(location);

    return types;
}

/**
 * @function
 * @description Determine the project type given the project location.
 *
 * @param location <Required | String> - The folder location to scan.
 *
 * @returns Promise<Array<string>>
 */
export async function determineProjectType(location: string): Promise<Array<string>> {
    logger.logInfo("Determining project type for project at location: " + location);

    if (! await utils.asyncFileExists(location)) {
        const msg = "The location does not exist: " + location;
        logger.logError(msg);
        const error = new Error(msg);
        error.name = "FILE_NOT_EXIST";
        throw error;
    }

    const types = [];
    let isValidLoc;

    if (await utils.asyncIsDirectory(location)) {

        for (let i = 0; i < projectHandlers.length; i++) {
            isValidLoc = await projectHandlers[i].typeMatches(location);
            if (isValidLoc) {
                types.push(projectHandlers[i].supportedType);
            }
        }
    }

    // Check for Docker projects if types array is empty
    if (types.length == 0) {
        isValidLoc = new DockerProject(DOCKER_TYPE).typeMatches(location);
        if (isValidLoc) {
            types.push(DOCKER_TYPE);
        }
    }

    logger.logInfo("The project location " + location + " matched types: " + types);
    return types;
}

/**
 * @function
 * @description Get all project types supported.
 *
 * @returns Array<string>
 */
export function getAllProjectTypes(): Array<string> {
    const types: string[] = [];
    projectHandlers.forEach((handler) => {
        if (handler.supportedType) {
            types.push(handler.supportedType);
        }
    });
    types.push(DOCKER_TYPE);
    return types;
}

/**
 * @function
 * @description Get extension project handler given the project info.
 *
 * @param projectInfo <Required | ProjectInfo> - The project info.
 */
async function getExtensionProjectHandler(projectInfo: ProjectInfo): Promise<any> {

    const key = projectInfo.projectID;
    let handler = extensionProjectHandlers[key];

    // is there an extension handler for the project?
    if (!handler) {

        const path = projectInfo.extensionID;

        // try to load extension handler if ID was provided
        if (path) {
            try {
                const files = await utils.asyncReadDir(path);
                if (files) {
                    if (files.includes(".sh-extension")) {
                        handler = new ShellExtensionProject(projectInfo.projectType);
                        await handler.init(projectInfo);
                        extensionProjectHandlers[key] = handler;
                    }
                }
            }
            catch (err) {
                logger.logError(`Failed to get extension project handler ${path} for ${projectInfo.location}`);
                logger.logError(err);
                return undefined;
            }
        }
    }

    return handler;
}

/**
 * @function
 * @description Get the selected project handler for the given project info.
 *
 * @param projectInfo <Required | ProjectInfo> - The project info.
 *
 * @returns any
 */
export async function getProjectHandler(projectInfo: ProjectInfo): Promise<any> {

    const projectType = projectInfo.projectType;

    if (!projectType) {
        return undefined;
    }

    for (let i = 0; i < projectHandlers.length; i++) {
        if (projectHandlers[i].supportedType === projectType) {
            return projectHandlers[i];
        }
    }

    // see if there's an extension to handle it
    const handler = await getExtensionProjectHandler(projectInfo);
    if (handler)
        return handler;

    return new DockerProject(DOCKER_TYPE);
}

/**
 * @function
 * @description Remove and return the project handler for the given project info. Note that
 * built-in handlers are never removed.
 *
 * @param projectInfo <Required | ProjectInfo> - The project info.
 *
 * @returns any
 */
export async function removeProjectHandler(projectInfo: ProjectInfo): Promise<any> {

    const handler = getProjectHandler(projectInfo);

    const key = projectInfo.projectID;
    if (extensionProjectHandlers[key]) {
        logger.logInfo(`Removing extension project handler ${key}`);
        delete extensionProjectHandlers[key];
    }

    return handler;
}

/**
 * @function
 * @description Get the project capability of a selected project.
 *
 * @param projectHandler <Required | Any> - The selected project handler for a project.
 *
 * @returns ProjectCapabilities
 */
export function getProjectCapabilities(projectHandler: any): ProjectCapabilities {
    if (projectHandler && projectHandler.hasOwnProperty("getCapabilities")) {
        return projectHandler.getCapabilities();
    }
    else {
        return defaultProjectCapabilities;
    }
}
