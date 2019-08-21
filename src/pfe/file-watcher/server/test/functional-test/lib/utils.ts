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
import * as _ from "lodash";

import * as app_configs from "../configs/app.config";
import * as pfe_configs from "../configs/pfe.config";
import { SocketIO } from "./socket-io";
import { ProjectCreation, projectAction, removeProjectFromBuildQueue } from "./project";
import { expect } from "chai";
import * as eventConfigs from "../configs/event.config";
import * as timeoutConfigs from "../configs/timeout.config";
import { fail } from "assert";

const pfeURL = pfe_configs.baseURL;

const mcWorkspace = app_configs.codewindWorkspaceDir;

export const existsAsync = promisify(fs.exists);
export const mkdirAsync = promisify(fs.mkdir);
export const copyAsync = promisify(fs.copyFile);
export const rmdirAsync = promisify(fs.rmdir);
export const unlinkAsync = promisify(fs.unlink);
export const writeAsync = promisify(fs.writeFile);
export const readFileAsync = promisify(fs.readFile);
export const openAsync = promisify(fs.open);
export const readAsync = promisify(fs.readFile);

export function pingPFE(callback: request.RequestCallback): request.Request {
    const pingUrl = _.cloneDeep(pfeURL) + pfe_configs.pfeAPIs.projects;
    return request.get(pingUrl, {rejectUnauthorized: false}, callback);
}

export function getRegistry(callback: request.RequestCallback): request.Request {
    const registryUrl = _.cloneDeep(pfeURL) + pfe_configs.pfeAPIs.registry;
    return request.get(registryUrl, {rejectUnauthorized: false}, callback);
}

export function cloneProject(projectName: string, parentPath: string, url: string, callback: request.RequestCallback): request.Request {
    return request.post({"url": pfeURL, "form": {"projectName": projectName, "parentPath": parentPath, "url": url}}, callback);
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
    fse.readdirSync(app_configs.codewindWorkspaceLogsDir)
        .filter(folder => regex.test(folder))
        .map((folder) => {
            const folderPath = path.join(app_configs.codewindWorkspaceLogsDir, folder);
            fse.rmdirSync(folderPath);
        });
}

export function setTestEnvVariables(): void {
    process.env.CW_LOCALES_DIR = app_configs.localesDir;
    process.env.CW_WORKSPACE = app_configs.codewindWorkspaceDir;
    process.env.CW_LOGS_DIR = app_configs.codewindWorkspaceLogsDir;
    process.env.CW_FWDATA_DIR = app_configs.fwDataDir;
    process.env.CW_PROJECTDATA_DIR = app_configs.projectDataDir;
    process.env.CW_WORKSPACESETTINGS_DIR = app_configs.workspaceSettingsDir;
    process.env.CW_EXTENSION_DIR = app_configs.extensionDir;
    process.env.IN_K8_REGISTRY = "codewindtest";
    process.env.DEFAULT_LOG_LEVEL = app_configs.DEFAULT_LOG_LEVEL;
    process.env.TEST_TYPE = process.env.IN_K8 ? "kube" : "local";
}

export function writeToFile(path: string, content: string, callback: (err: Error, msg: string) => void): void {
    fs.writeFile(path, content, (err) => {
        if (err) callback(err, undefined);
        callback(undefined, `Successfully written content to ${path}`);
    });
}

export function rebuildProjectAfterHook(socket: SocketIO, projData: ProjectCreation): void {
    after(`rebuild project ${projData.projectType}`, async function (): Promise<void> {
        this.timeout(timeoutConfigs.createTestTimeout);
        await rebuildProject(socket, projData);
    });
}

export async function rebuildProject(socket: SocketIO, projData: ProjectCreation, checkEvent?: string, checkEventData?: any): Promise<void> {
    const testData: any = {
        action: "build",
        projectType: projData.projectType,
        location: projData.location,
        projectID: projData.projectID,
    };

    const info: any = await projectAction(testData);
    expect(info);

    const targetEvent = checkEvent || eventConfigs.events.statusChanged;
    const data = checkEventData || {
        "projectID": projData.projectID,
        "appStatus": "started"
    };

    let eventFound = false;
    let event: any;
    await new Promise((resolve) => {
        const timer = setInterval(() => {
            const events = socket.getAllEvents();
            if (events && events.length >= 1) {
                event =  events.filter((value) => {
                    if (value.eventName === targetEvent && _.isMatch(value.eventData, data)) {
                        return value;
                    }
                })[0];
                if (event) {
                    eventFound = true;
                    clearInterval(timer);
                    return resolve();
                }
            }
        }, timeoutConfigs.defaultInterval);
    });

    if (eventFound && event) {
        expect(event);
        expect(event.eventName);
        expect(event.eventName).to.equal(targetEvent);
        expect(event.eventData);
        expect(_.isMatch(event.eventData, data));
    } else {
        fail(`failed to find ${targetEvent} for rebuild project ${projData.projectType}`);
    }
}

export async function removeProjectFromRunningBuild(projectID: string): Promise<void> {
    const runningBuildQueue = await removeProjectFromBuildQueue(projectID);
    expect(runningBuildQueue);
    expect(runningBuildQueue).to.not.include(projectID);
}
