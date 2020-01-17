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
/**
 * This file for codewind application configuration such as workspace and etc.
 */
import * as path from "path";

const CW_WORKSPACE = "codewind-workspace";
export const codewindWorkspaceDir =  process.env.CW_WORKSPACE || path.resolve(__dirname, "..", "..", "..", "..", "..", "..", "..", CW_WORKSPACE);
export const codewindWorkspaceLogsDir =  process.env.CW_LOGS_DIR || path.join(codewindWorkspaceDir, ".logs");
export const localesDir = process.env.CW_LOCALES_DIR || path.resolve(__dirname, "..", "..", "..", "src", "utils", "locales") + path.sep;
export const fwDataDir = process.env.CW_FWDATA_DIR || path.resolve(__dirname, "..", "..", "..", "..", "fwdata");
export const projectDataDir = process.env.CW_PROJECTDATA_DIR || path.join(fwDataDir, "projects");
export const workspaceSettingsDir = process.env.CW_WORKSPACESETTINGS_DIR || path.join(codewindWorkspaceDir, ".config");
export const extensionDir = process.env.CW_EXTENSION_DIR || path.join(codewindWorkspaceDir, ".extensions") + path.sep;

export const projectPrefix = "turbinetest-";
export const projectConfigs = {
    "appSuffix": Date.now(),
    "appDirectory": path.join(codewindWorkspaceDir, projectPrefix)
};

export enum codewindTemplates {
    default = "default",
    docker = "docker",
    odo = "odo"
}

export enum projecLanguges {
    go = "go",
    lagom = "lagom",
    liberty = "liberty",
    nodejs = "nodejs",
    perl = "perl",
    python = "python",
    spring = "spring",
    swift = "swift"
}

export const extensionPaths: any = {
    [codewindTemplates.odo]: path.join(extensionDir, `codewind-odo-extension`)
};

export const projectTypes: any = {
    [codewindTemplates.default]: [
        projecLanguges.liberty,
        // projecLanguges.nodejs,
        // projecLanguges.spring,
        // projecLanguges.swift
    ],
    // [codewindTemplates.docker]: [
    //     projecLanguges.go,
    //     projecLanguges.lagom,
    //     projecLanguges.python
    // ],
    // [codewindTemplates.odo]: process.env.IN_K8 ? [
    //     projecLanguges.nodejs,
    //     projecLanguges.perl,
    //     projecLanguges.python
    // ] : []
};

export const templateNames: any = {
    [codewindTemplates.default] : {
        [projecLanguges.liberty]: "javamicroprofiletemplate",
        [projecLanguges.nodejs]: "node",
        [projecLanguges.spring]: "springjavatemplate",
        [projecLanguges.swift]: "swifttemplate",
    },
    [codewindTemplates.docker]: {
        [projecLanguges.go]: "gotemplate",
        [projecLanguges.lagom]: "lagomjavatemplate",
        [projecLanguges.python]: "pythontemplate",
    }
};

export const DEFAULT_LOG_LEVEL = "trace";
