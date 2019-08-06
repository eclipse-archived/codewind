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
import * as fse from "fs-extra";
import * as request from "request";
import * as fs from "fs";
import { promisify } from "util";

import * as app_configs from "../configs/app.config";
import * as pfe_configs from "../configs/pfe.config";

const pfeURL = pfe_configs.pfe.PROTOCOL + "://" + pfe_configs.pfe.HOST + ":" + pfe_configs.pfe.PORT + pfe_configs.pfeAPIs.projects;

const mcWorkspace = app_configs.microclimateWorkspaceDir;

const fixtures = app_configs.fixturesDir;

export const existsAsync = promisify(fs.exists);
export const mkdirAsync = promisify(fs.mkdir);
export const copyAsync = promisify(fs.copyFile);
export const rmdirAsync = promisify(fs.rmdir);
export const unlinkAsync = promisify(fs.unlink);
export const writeAsync = promisify(fs.writeFile);

export function pingPFE(callback: request.RequestCallback): request.Request {
    return request.get(pfeURL, callback);
}

export function cloneProject(projectName: string, parentPath: string, url: string, callback: request.RequestCallback): request.Request {
    return request.post({"url": pfeURL, "form": {"projectName": projectName, "parentPath": parentPath, "url": url}}, callback);
}

export function deleteFixtures(callback: any): any {
    fse.remove(fixtures, callback);
}

export function copyFixtures(callback: any): any {
    fse.copy(fixtures, mcWorkspace, callback);
}

export function cleanWorkspace(): any {
    fse.readdir(mcWorkspace, (err, folders) => {
        if (err) {
            console.error(err);
        }
        for (const folder of folders) {
            const match = folder.match(/microclimatetest*/);
            if (match) {
                const toDelete = path.join(mcWorkspace, folder);
                fse.removeSync(toDelete);
            }
        }
    });
}

export function createFWDataDir(): any {
    if (!fse.existsSync(app_configs.fwDataDir)) {
        fse.mkdirSync(app_configs.fwDataDir);
        fse.mkdirSync(app_configs.projectDataDir);
    }
}

 export function removeFWDataDir(): any {
    if (fse.existsSync(app_configs.fwDataDir)) {
        fse.removeSync(app_configs.fwDataDir);
    }
}

export function cleanUpLogsDir(): any {
    const regex = new RegExp(/microclimatetest*/g);
    fse.readdirSync(app_configs.microclimateWorkspaceLogsDir)
        .filter(folder => regex.test(folder))
        .map((folder) => {
            const folderPath = path.join(app_configs.microclimateWorkspaceLogsDir, folder);
            fse.rmdirSync(folderPath);
        });
}

export function setTestEnvVariables(): void {
    process.env.CW_LOCALES_DIR = app_configs.localesDir;
    process.env.CW_WORKSPACE = app_configs.microclimateWorkspaceDir;
    process.env.CW_LOGS_DIR = app_configs.microclimateWorkspaceLogsDir;
    process.env.CW_FWDATA_DIR = app_configs.fwDataDir;
    process.env.CW_PROJECTDATA_DIR = app_configs.projectDataDir;
    process.env.CW_WORKSPACESETTINGS_DIR = app_configs.workspaceSettingsDir;
}
