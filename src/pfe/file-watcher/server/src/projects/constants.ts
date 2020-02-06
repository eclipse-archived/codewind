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
export const workspaceDir = process.env.CW_WORKSPACE ||  path.join(path.sep, "codewind-workspace", path.sep);
// project constants
export const projectConstants = {
    projectsDataDir: process.env.CW_PROJECTDATA_DIR || path.join(path.sep, "file-watcher", "fwdata", "projects", path.sep),
    projectsLogDir: process.env.CW_LOGS_DIR || path.join(workspaceDir, ".logs", path.sep),
    projectsInfoDir: path.join(workspaceDir, ".projects", path.sep),
    projectsExtensionDir: path.join(workspaceDir, ".extensions", path.sep),
    containerPrefix: "cw-"
};

// workspace constants
export const workspaceConstants = {
    workspaceSettingsDir: process.env.CW_WORKSPACESETTINGS_DIR ||  path.join(workspaceDir, ".config", path.sep),
    workspaceSettingsFile: path.join(process.env.CW_WORKSPACESETTINGS_DIR ||  path.join(workspaceDir, ".config", path.sep), "settings.json"),
    workspaceExtensionDir: path.join(workspaceDir, ".extensions", path.sep)
};

export enum eventTypes { projectCreation, projectChanged }

export enum ContainerStates { containerNotFound, containerStopped, containerStarting, containerActive }

export enum StartModes { run = "run", debug = "debug", debugNoInit = "debugNoInit" }

export enum ControlCommands { stop = "stop", start = "start", restart = "restart" }

export enum MavenFlags { profile = "-P ", properties = "-D " }

export const disablePingPort = "-1";

export const buildQueueInterval = 5000;
