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

import { Operation } from "../projects/operation";
import { ProjectInfo, BuildLog, AppLog, ProjectCapabilities } from "../projects/Project";
import * as projectEventsController from "../controllers/projectEventsController";

/**
 * @interface
 * @description Interface representing an extension project.
 */
export interface IExtensionProject {

    supportedType: string;

    /**
     * @function
     * @description Create operation for the project.
     *
     * @param operation <Required | Operation> - The create operation.
     */
    create(operation: Operation): void;

    /**
     * @function
     * @description Update operation for the project.
     *
     * @param operation <Required | Operation> - The update operation.
     * @param changedFiles <Optional | projectEventsController.IFileChangeEvent[]> - The file changed event array.
     */
    update(operation: Operation, changedFiles?: projectEventsController.IFileChangeEvent[]): void;

    /**
     * @function
     * @description Start the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    start?(projectInfo: ProjectInfo): Promise<void>;

    /**
     * @function
     * @description Stop the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    stop?(projectInfo: ProjectInfo): Promise<void>;

    /**
     * @function
     * @description Rebuild operation for the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    rebuild(projectInfo: ProjectInfo): Promise<void>;

    /**
     * @function
     * @description Delete container for the project.
     *
     * @param projectInfo <Required | ProjectInfo> - The metadata information for the project.
     */
    deleteContainer(projectInfo: ProjectInfo): Promise<void>;

    /**
     * @function
     * @description Validate project.
     *
     * @param operation <Required | Operation> - The validate operation for the project.
     */
    validate?(operation: Operation): Promise<void>;

    /**
     * @function
     * @description Get the build log for the project.
     *
     * @param logDirectory <Required | string> - The log location directory.
     *
     * @returns Promise<BuildLog>
     */
    getBuildLog?(logDirectory: string): Promise<BuildLog>;

    /**
     * @function
     * @description Get the app log for the project.
     *
     * @param logDirectory <Required | String> - The log location directory.
     *
     * @returns Promise<AppLog>
     */
    getAppLog?(logDirectory: string): Promise<AppLog>;

    /**
     * @function
     * @description Get the all possible app port(s) for projects that this handler handles.
     *
     * @returns string | string[]
     */
    getDefaultAppPort?(): string | string[];

    /**
     * @function
     * @description Get the default debug port of the project.
     *
     * @returns string
     */
    getDefaultDebugPort?(): string;

    /**
     * @function
     * @description Get the project capabilities of the project.
     *
     * @returns ProjectCapabilities
     */
    getProjectCapabilities?(): ProjectCapabilities;

    /**
     * @function
     * @description Return a reproducible container name for the project.
     *
     * @param projectID <Required | string> - An alphanumeric identifier for a project.
     * @param projectLocation <Required | string> - The project location directory.
     *
     * @returns Promise<string>
     */
    getContainerName?(projectID: string, projectLocation: string): Promise<string>;

    /**
     * @function
     * @description Return a reproducible app name for the project.
     *
     * @param projectID <Required | string> - An alphanumeric identifier for a project.
     *
     * @returns Promise<string>
     */
    getAppName?(projectID: string): Promise<string>;

    /**
     * @function
     * @description Get the internal app port that the project uses.
     *
     * @param projectID <Required | string> - An alphanumeric identifier for a project.
     *
     * @returns Promise<string>
     */
    getAppPort?(projectID: string): Promise<string>;
}
