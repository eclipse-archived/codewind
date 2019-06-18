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
import * as fs from "fs-extra";
import * as request from "request";

import * as app_configs from "../configs/app.config";
import * as pfe_configs from "../configs/pfe.config";

const pfeURL = pfe_configs.pfe.PROTOCOL + "://" + pfe_configs.pfe.HOST + ":" + pfe_configs.pfe.PORT + pfe_configs.pfeAPIs.projects;

const mcWorkspace = app_configs.microclimateWorkspaceDir;

const fixtures = app_configs.fixturesDir;

export function pingPFE(callback: request.RequestCallback): request.Request {
    return request.get(pfeURL, callback);
}

export function deleteFixtures(callback: any): any {
    fs.remove(fixtures, callback);
}

export function copyFixtures(callback: any): any {
    fs.copy(fixtures, mcWorkspace, callback);
}

export function cleanWorkspace(): any {
    fs.readdir(mcWorkspace, (err, folders) => {
        if (err) {
            console.error(err);
        }
        for (const folder of folders) {
            const match = folder.match(/microclimatetest*/);
            if (match) {
                const toDelete = path.join(mcWorkspace, folder);
                fs.removeSync(toDelete);
            }
        }
    });
}

export function createFWDataDir(): any {
    if (!fs.existsSync(app_configs.fwDataDir)) {
        fs.mkdirSync(app_configs.fwDataDir);
        fs.mkdirSync(app_configs.projectDataDir);
    }
}

 export function removeFWDataDir(): any {
    if (fs.existsSync(app_configs.fwDataDir)) {
        fs.removeSync(app_configs.fwDataDir);
    }
}

export function cleanUpLogsDir(): any {
    const regex = new RegExp(/microclimatetest*/g);
    fs.readdirSync(app_configs.microclimateWorkspaceLogsDir)
        .filter(folder => regex.test(folder))
        .map((folder) => {
            const folderPath = path.join(app_configs.microclimateWorkspaceLogsDir, folder);
            fs.rmdirSync(folderPath);
        });
}

export function setTestEnvVariables(): void {
    process.env.CW_LOCALES_DIR = app_configs.localesDir;
    process.env.CW_WORKSPACE = app_configs.microclimateWorkspaceDir;
    process.env.CW_LOGS_DIR = app_configs.microclimateWorkspaceLogsDir;
    process.env.CW_FWDATA_DIR = app_configs.fwDataDir;
    process.env.CW_PROJECTDATA_DIR = app_configs.projectDataDir;
}
