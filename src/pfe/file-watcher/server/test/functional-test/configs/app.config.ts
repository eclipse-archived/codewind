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
import * as path from "path";


const CW_WORKSPACE = "codewind-workspace";
export const codewindWorkspaceDir =  process.env.CW_WORKSPACE || path.resolve(__dirname, "..", "..", "..", "..", "..", "..", "..", CW_WORKSPACE);
export const codewindWorkspaceLogsDir =  process.env.CW_LOGS_DIR || path.join(codewindWorkspaceDir, ".logs");
export const localesDir = process.env.CW_LOCALES_DIR || path.resolve(__dirname, "..", "..", "..", "src", "utils", "locales") + path.sep;
export const fwDataDir = process.env.CW_FWDATA_DIR || path.resolve(__dirname, "..", "..", "..", "..", "fwdata");
export const projectDataDir = process.env.CW_PROJECTDATA_DIR || path.join(fwDataDir, "projects");
export const workspaceSettingsDir = process.env.CW_WORKSPACESETTINGS_DIR || path.join(codewindWorkspaceDir, ".config");
export const extensionDir = process.env.CW_EXTENSION_DIR || path.join(codewindWorkspaceDir, ".extensions") + path.sep;

export const projectPrefix = "codewindtest";
export const projectConfigs = {
    "appSuffix": Date.now(),
    "appDirectory": path.join(codewindWorkspaceDir, projectPrefix)
};

export const projectTypes = ["docker"];
export const supportedDockerProjects = ["go", "python", "lagom"];

export const projectCapabilities: any = {
    "docker": {
        "startModes": ["run"],
        "controlCommands": []
    }
};

export const restartCapabilities: any = {
    "docker": false
};

export const debugCapabilities: any = {
    "docker": false
};

export const defaultInternalPorts: any = {
    "go": ["8000"],
    "python": ["5000"],
    "lagom": ["8778", "9779"]
};

export const exposedDebugPorts: any = {
    "go": ["1000"], // fake debug ports - go doesn't support debug
    "python": ["1000"], // fake debug ports - python doesn't support debug
    "lagom": ["1000"], // fake debug ports - python doesn't support debug
};
