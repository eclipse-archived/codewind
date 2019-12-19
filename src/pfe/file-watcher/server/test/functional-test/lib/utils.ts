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
import * as projectsController from "../../../src/controllers/projectsController";
import { projectAction, updateStatus } from "./project";
import { expect } from "chai";
import * as project_configs from "../configs/project.config";
import * as eventConfigs from "../configs/event.config";
import * as timeoutConfigs from "../configs/timeout.config";
import { fail } from "assert";
import dockerode from "dockerode";

const chalk = require("chalk"); // tslint:disable-line:no-require-imports

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

const Client = require("kubernetes-client").Client; // tslint:disable-line:no-require-imports
const config = require("kubernetes-client").config; // tslint:disable-line:no-require-imports

const TEST_LOG_CONTEXTS = ["before", "after", "describe", "it", "info"];
const TEST_LOG_COLORS: any = {
    [TEST_LOG_CONTEXTS[0]]: "yellowBright",
    [TEST_LOG_CONTEXTS[1]]: "yellowBright",
    [TEST_LOG_CONTEXTS[2]]: "greenBright",
    [TEST_LOG_CONTEXTS[3]]: "magentaBright",
    [TEST_LOG_CONTEXTS[4]]: "cyanBright"
};

const docker = new dockerode();
let k8sClient: any = undefined;

if (process.env.IN_K8) {
    k8sClient = new Client({ config: config.getInCluster(), version: "1.9"});
}

export function pingPFE(callback: request.RequestCallback): request.Request {
    const pingUrl = _.cloneDeep(pfeURL) + pfe_configs.pfeAPIs.projects;
    return request.get(pingUrl, {rejectUnauthorized: false}, callback);
}

export function getRegistry(callback: request.RequestCallback): request.Request {
    const imagePushRegistryUrl = _.cloneDeep(pfeURL) + pfe_configs.pfeAPIs.imagepushregistry;
    return request.get(imagePushRegistryUrl, {rejectUnauthorized: false}, callback);
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
    process.env.DEFAULT_LOG_LEVEL = app_configs.DEFAULT_LOG_LEVEL;
    process.env.TEST_TYPE = process.env.IN_K8 ? "kube" : "local";
}

export function writeToFile(path: string, content: string, callback: (err: Error, msg: string) => void): void {
    fs.writeFile(path, content, (err) => {
        if (err) callback(err, undefined);
        callback(undefined, `Successfully written content to ${path}`);
    });
}

export async function callProjectAction(action: string, startMode: string, socket: SocketIO, projData: projectsController.ICreateProjectParams, checkEvent?: Array<string>, checkEventData?: Array<any>): Promise<void> {
    const testData: any = {
        action: action,
        projectType: projData.projectType,
        location: projData.location,
        projectID: projData.projectID,
    };
    if (startMode) testData["startMode"] = startMode;

    const info: any = await projectAction(testData);
    expect(info);

    const targetEvents = checkEvent || [eventConfigs.events.statusChanged];
    const targetDatas = checkEventData || [{
        "projectID": projData.projectID,
        "appStatus": "started"
    }];

    for (const socketEvent of targetEvents) {
        const index = targetEvents.indexOf(socketEvent);
        const data = targetDatas[index];
        await waitForEvent(socket, socketEvent, data);
    }
    return;
}

export async function waitForEvent(socket: SocketIO, targetEvent: string, eventData?: any, eventKeys?: Array<string>): Promise<any> {
    let eventFound = false;
    let event: any;

    await new Promise((resolve) => {
        const timer = setInterval(() => {
            const events = socket.getAllEvents();

            if (events && events.length >= 1) {
                event =  events.filter((value) => {
                    const condition = (eventData ? _.isMatch(value.eventData, eventData) : true) && (eventKeys ? _.difference(eventKeys, Object.keys(value.eventData)).length === 0 : true);
                    if (value.eventName === targetEvent && condition) return value;
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
        expect(_.isMatch(event.eventData, eventData));
    } else {
        fail(`failed to find ${targetEvent}`);
    }

    return event;
}

/**
 * @function
 * @description Util function to set the build status of a project. We need to do it for project that relies on script or IDC code and brute set the build status of a project.
 *
 * @param projData <Required | projectsController.ICreateProjectParams> - The project creation data.
 * @param status <Optional | String> - The status to update to.
 *
 * @returns Promise<void>
 */
export async function setBuildStatus(projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string, status?: string): Promise<void> {
    if (project_configs.needManualReset[projectTemplate] && project_configs.needManualReset[projectTemplate][projectLang] && project_configs.needManualReset[projectTemplate][projectLang]["buildStatus"]) {
        const info = await updateStatus({
            "projectID": projData.projectID,
            "type": "buildState",
            "buildStatus": status || "success"
        });
        expect(info);
        expect(info.statusCode).to.equal(200);
    }
}

export async function setAppStatus(projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string, status?: string, msg?: string): Promise<void> {
    if (project_configs.needManualReset[projectTemplate] && project_configs.needManualReset[projectTemplate][projectLang] && project_configs.needManualReset[projectTemplate][projectLang]["appStatus"]) {
        const info = await updateStatus({
            "projectID": projData.projectID,
            "type": "appState",
            "status": status || "started",
            "error": msg || `This message indicates the app status was set in Turbine test`
        });
        expect(info);
        expect(info.statusCode).to.equal(200);
    }
}

export async function delay(ms: number): Promise<void> {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

/**
 * @function
 * @description Turbine test logging function which can be used to log at various level of mocha contexts.
 *
 * @param suite <Required | String> - The name of the test suite.
 * @param context <Required | String> - The name of the context, e.g before, after or describe.
 * @param msg <Required | String> - The log message to display.
 *
 * @returns void
 */
export function logMsg(suite: string, context: string, msg: string): void {
    if (!TEST_LOG_CONTEXTS.includes(context) || !process.env.HIDE_TURBINE_TEST_LOG) return;
    writeLog(TEST_LOG_COLORS[context], suite, context, msg);
}

function writeLog(color: any, suite: string, context: string, msg: string): void {
    console.log(chalk[color](`[${new Date().toUTCString()}] [Suite: ${suite}] [Context: ${context}] ${msg}`));
}

export async function getAllDockerContainerInfo(containerName?: string): Promise<Array<any>> {
    const containers = await docker.listContainers();
    const containerInfos = [];
    if (containerName) {
        for (const containerInfo of containers) {
            for (const cName of containerInfo.Names) {
                if (cName.includes(containerName)) {
                    containerInfos.push(containerInfo);
                }
            }
        }
        return _.uniq(containerInfos);
    } else {
        return containers;
    }
}

export async function getDockerContainerNames(): Promise<Array<string>> {
    const containers = await getAllDockerContainerInfo();
    const containerNames = [];
    for (const containerInfo of containers) {
        for (const containerName of containerInfo.Names) {
            containerNames.push(containerName);
        }
    }
    return containerNames;
}

export async function getDockerImageNames(): Promise<Array<string>> {
    const images = await docker.listImages();
    const imageNames = [];
    for (const imageInfo of images) {
        if (imageInfo.RepoTags) {
            for (const imageName of imageInfo.RepoTags) {
                imageNames.push(imageName);
            }
        }
    }
    return imageNames;
}


export async function checkForDockerResources(projectID: string, exists: boolean = true): Promise<void> {
    const containerInfo = await getAllDockerContainerInfo(projectID);
    const containerName = await getDockerContainerNames();
    const imageName = await getDockerImageNames();

    if (exists) {
        expect(containerInfo);
        expect(containerInfo[0].Image.includes(projectID));
        expect(imageName.includes(projectID));
        expect(containerName.includes(projectID));
    } else {
        expect(!containerInfo);
        expect(!imageName.includes(projectID));
        expect(!containerName.includes(projectID));
    }
}

export async function checkForKubeResources(projectID: string, exists: boolean = true): Promise<void> {
    let deploymentResp, podResp, serviceResp;
    try {
        deploymentResp = await k8sClient.apis.apps.v1.namespaces(pfe_configs.cheNamespace).deployments.get({ qs: { labelSelector: "projectID=" + projectID } });
        podResp = await k8sClient.api.v1.namespaces(pfe_configs.cheNamespace).pods.get({ qs: { labelSelector: "projectID=" + projectID } });
        serviceResp = await k8sClient.api.v1.namespaces(pfe_configs.cheNamespace).services.get({ qs: { labelSelector: "projectID=" + projectID } });

        if (exists) {
            expect(deploymentResp);
            expect(deploymentResp.body);
            expect(deploymentResp.body.items);
            expect(deploymentResp.body.items.length).to.be.greaterThan(0);
            expect(deploymentResp.body.items[0].metadata.name).includes(projectID);

            expect(podResp);
            expect(podResp.body);
            expect(podResp.body.items);
            expect(podResp.body.items.length).to.be.greaterThan(0);
            expect(podResp.body.items[0].metadata.name).includes(projectID);

            expect(serviceResp);
            expect(serviceResp.body);
            expect(serviceResp.body.items);
            expect(serviceResp.body.items.length).to.be.greaterThan(0);
            expect(serviceResp.body.items[0].metadata.name).includes(projectID);
        } else {
            expect(deploymentResp);
            expect(deploymentResp.body.items);
            expect(deploymentResp.body.items.length).to.equal(0);

            expect(serviceResp);
            expect(serviceResp.body.items);
            expect(serviceResp.body.items.length).to.equal(0);
        }
    } catch (err) {
        fail(`failed to find kube deployment ${err}`);
    }
}
