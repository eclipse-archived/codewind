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
import * as crypto from "crypto";
import { ProjectInfo } from "./Project";

/**
 * @class
 * @description The class representing project operations.
 */
export class Operation {

    operationId: string = "";
    type: string = "";
    projectInfo: ProjectInfo = {} as ProjectInfo;
    containerName?: string;

    /**
     * @constructor
     * @description Constructor for the operation class.
     *
     * @param type <Required | String> - The operation type.
     * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
     */
    constructor(type: string, projectInfo: ProjectInfo) {
        this.operationId = crypto.randomBytes(16).toString("hex");
        this.type = type;
        this.projectInfo = projectInfo;
    }
}
