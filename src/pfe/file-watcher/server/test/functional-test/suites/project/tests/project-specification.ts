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
import mocha from "mocha";
import { expect } from "chai";
import * as _ from "lodash";
import path from "path";
import fs from "fs";

import { ProjectCreation, projectSpecification, getApplicationContainerInfoInK8, getApplicationContainerInfo } from "../../../lib/project";

import * as project_configs from "../../../configs/project.config";
import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { SocketIO } from "../../../lib/socket-io";
import { fail } from "assert";
import { Operation } from "../../../../../src/projects/operation";
import * as projectUtil from "../../../../../src/projects/projectUtil";

import * as utils from "../../../lib/utils";

export function projectSpecificationTest(socket: SocketIO, projData: ProjectCreation, projectLang: string): void {
    describe("projectSpecification function", () => {
        const data: any = {
            "projectID": projData.projectID
        };

        const testExposedPort = "8888";
        const testContextRoot = "/hello";
        const testHealthCheck = "/health";

        const combinations: any = {
            "combo1": {
                "setting": "internalPort",
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", "status", "ports"]
            },
            "combo2": {
                "setting": "internalDebugPort",
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", "status", "ports"]
            },
            "combo3": {
                "setting": "contextRoot",
                "value":  testContextRoot,
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", "contextRoot", "status"]
            },
            "combo4": {
                "setting": "healthCheck",
                "value":  testHealthCheck,
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", "name", "healthCheck", "status"]
            },
            "combo5": {
                "setting": "mavenProfiles",
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", "mavenProfiles", "status"]
            },
            "combo6": {
                "setting": "mavenProperties",
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", "mavenProperties", "status"]
            },
            "combo7": {
                "setting": "ignoredPaths",
                "value": [
                    "*/node_modules*",
                    "*/.git/*",
                    "*/.DS_Store",
                    "*/.dockerignore",
                    "*/.gitignore",
                ],
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", "ignoredPaths", "status"]
            }
        };

        afterEach("clear socket events", () => {
            socket.clearEvents();
        });

        before("add expose port to project type with only one exposed port", async function(): Promise<void> {
            if (! project_configs.oneExposedPortOnly[projectLang]) return;
            this.timeout(timeoutConfigs.defaultTimeout);
            const dockerfile = path.join(projData.location, "Dockerfile");
            await fs.appendFileSync(dockerfile, `\nEXPOSE ${testExposedPort}`);
            await utils.rebuildProject(socket, projData);
        });

        after("remove added exposed port to project type", async function(): Promise<void> {
            if (! project_configs.oneExposedPortOnly[projectLang]) return;
            this.timeout(timeoutConfigs.defaultTimeout);
            const dockerfile = path.join(projData.location, "Dockerfile");
            const fileOutput = await fs.readFileSync(dockerfile, {encoding: "utf-8"});
            await fs.writeFileSync(dockerfile, fileOutput.replace(new RegExp(`EXPOSE ${testExposedPort}`, "g"), ""), {encoding: "utf-8"}) ;
            await utils.rebuildProject(socket, projData);
        });

        after("reset internal port", async function(): Promise<void> {
            this.timeout(timeoutConfigs.defaultTimeout);
            await runProjectSpecificationSettingTest(combinations["combo1"], project_configs.defaultInternalPorts[projectLang]);
        });

        after("reset context root", async function (): Promise<void> {
            this.timeout(timeoutConfigs.defaultTimeout);
            await runProjectSpecificationSettingTest(combinations["combo3"], project_configs.defaultContextRoot[projectLang] || "/");
        });

        after("reset health check", async function (): Promise<void> {
            this.timeout(timeoutConfigs.defaultTimeout);
            if (!project_configs.defaultHealthCheckEndPoint[projectLang]) return;
            await runProjectSpecificationSettingTest(combinations["combo4"], project_configs.defaultHealthCheckEndPoint[projectLang]);
        });

        utils.rebuildProjectAfterHook(socket, projData);

        it("set project specification without project id", async () => {
            const testData = _.cloneDeep(data);
            delete testData["projectID"];
            const info: any = await projectSpecification(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.error);
            expect(info.error).to.haveOwnProperty("msg");
            expect(info.error["msg"]).to.equal("BAD_REQUEST: The project id was not provided. ");
        });

        it("set project specification without project settings", async () => {
            const testData = _.cloneDeep(data);
            const info: any = await projectSpecification(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.error);
            expect(info.error).to.haveOwnProperty("msg");
            expect(info.error["msg"]).to.equal("BAD_REQUEST: The settings were not provided. ");
        });

        it("set project specification with invalid project setting key", async () => {
            const testData = _.cloneDeep(data);
            const invalidKey = "invalidKey";
            testData["settings"] = {
                [invalidKey]: "someValue",
            };
            const info: any = await projectSpecification(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(202);
            expect(info.operationId);

            const targetEvent = eventConfigs.events.settingsChanged;
            let eventFound = false;
            let event: any;
            await new Promise((resolve) => {
                const timer = setInterval(() => {
                    const events = socket.getAllEvents();
                    if (events && events.length >= 1) {
                        event =  events.filter((value) => {
                            if (value.eventName === targetEvent) return value;
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
                expect(event.eventData["operationId"]);
                expect(event.eventData["projectID"]);
                expect(event.eventData["projectID"]).to.equal(projData.projectID);
                expect(event.eventData["status"]);
                expect(event.eventData["status"]).to.equal("failed");
                expect(event.eventData["error"]);
                expect(event.eventData["error"]).to.equal(`BAD_REQUEST: ${invalidKey} is not a configurable setting.`);
            } else {
                fail(`failed to find ${targetEvent} for project specific setting`);
            }
        }).timeout(timeoutConfigs.defaultTimeout);

        it("set project specification with undefined project setting key", async () => {
            const testData = _.cloneDeep(data);
            testData["settings"] = {
                "internalPort": undefined
            };
            const info: any = await projectSpecification(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(202);
            expect(info.operationId);

            const targetEvent = eventConfigs.events.settingsChanged;
            let eventFound = false;
            let event: any;
            await new Promise((resolve) => {
                const timer = setInterval(() => {
                    const events = socket.getAllEvents();
                    if (events && events.length >= 1) {
                        event =  events.filter((value) => {
                            if (value.eventName === targetEvent) return value;
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
                expect(event.eventData["operationId"]);
                expect(event.eventData["projectID"]);
                expect(event.eventData["projectID"]).to.equal(projData.projectID);
                expect(event.eventData["status"]);
                expect(event.eventData["status"]).to.equal("failed");
                expect(event.eventData["error"]);
                expect(event.eventData["error"]).to.equal(`BAD_REQUEST: Each setting must have a name and a value.`);
            } else {
                fail(`failed to find ${targetEvent} for project specific setting`);
            }
        }).timeout(timeoutConfigs.defaultTimeout);

        _.forEach(combinations, (combo) => {
            it(`config project specification settings ${combo["setting"]}`, async () => {
                if (combo["setting"] === "healthCheck" && !project_configs.defaultHealthCheckEndPoint[projectLang]) return;
                await runProjectSpecificationSettingTest(combo);
            }).timeout(timeoutConfigs.defaultTimeout);
        });

        async function runProjectSpecificationSettingTest(combo: any, valueCheck?: string): Promise<void> {
            const setting = combo["setting"];
            let value = valueCheck || combo["value"];

            if (setting === "internalPort") {
                const projectInfo = await projectUtil.getProjectInfo(projData.projectID);
                if (process.env.IN_K8) {
                    const containerInfo = await getApplicationContainerInfoInK8(projectInfo, new Operation("general", projectInfo));
                    const currentInternalPort = containerInfo.internalPort;
                    const podPorts = containerInfo.podPorts.filter((val) => {
                        return val != currentInternalPort;
                    });
                    value = value || podPorts[Math.floor(Math.random() * podPorts.length)];
                } else {
                    const containerName = await projectUtil.getContainerName(projectInfo);
                    const containerInfo = await getApplicationContainerInfo(projectInfo, containerName);
                    const currentInternalPort = containerInfo.internalPort;
                    const containerPorts = containerInfo.containerPorts.filter((val) => {
                        return val != currentInternalPort;
                    });
                    value = value || containerPorts[Math.floor(Math.random() * containerPorts.length)];
                }
            }
            if (setting === "internalDebugPort") {
                if (process.env.IN_K8) return; // internal debug port setting is not supported in kube
                const exposedDebugPorts = project_configs.exposedDebugPorts[projData.projectType];
                value = value || exposedDebugPorts[Math.floor(Math.random() * exposedDebugPorts.length)];
            }
            if (setting === "mavenProfiles" || setting === "mavenProperties") {
                if (!project_configs.mavenProfileCapabilities[projData.projectType]) {
                    value = [];
                    combo["eventKeys"].push("error");
                }
                // for spring and liberty project types support maven profiles we need to set the value here
            }

            const testData = _.cloneDeep(data);
            testData["settings"] = {
                [setting]: value
            };
            const info: any = await projectSpecification(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(202);
            expect(info.operationId);

            if (combo["socketEvent"] && combo["eventKeys"]) {
                if (setting === "internalDebugPort" && !project_configs.debugCapabilities[projData.projectType]) {
                    combo["eventKeys"].push("error");
                }

                const targetEvent = combo["socketEvent"];
                let eventFound = false;
                let event: any;
                await new Promise((resolve) => {
                    const timer = setInterval(() => {
                        const events = socket.getAllEvents();
                        if (events && events.length >= 1) {
                            event =  events.filter((value) => {
                                if (value.eventName === targetEvent && _.isEqual(_.sortBy(Object.keys(value.eventData)), _.sortBy(combo["eventKeys"]))) return value;
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

                    for (const eventKey of combo["eventKeys"]) {
                        expect(event.eventData).to.haveOwnProperty(eventKey);

                        if (eventKey === "projectID") {
                            expect(event.eventData[eventKey]).to.equal(projData.projectID);
                        }
                        if (eventKey === "ports") {
                            expect(event.eventData[eventKey][setting]).to.equal(value);
                        }
                        if (eventKey === "contextRoot" || eventKey === "healthCheck") {
                            expect(event.eventData[eventKey]).to.equal(value);
                        }

                        if (setting === "internalDebugPort" && !project_configs.debugCapabilities[projData.projectType]) {
                            expect(event.eventData.error);
                            expect(event.eventData.error).to.equal(`BAD_REQUEST: The project does not support debug mode.`);
                        }
                        if (setting === "internalDebugPort" && process.env.IN_K8) {
                            expect(event.eventData.error);
                            expect(event.eventData.error).to.equal(`BAD_REQUEST: debug mode is not supported on Kubernetes.`);
                        }
                        if (setting === "mavenProfiles" && !project_configs.mavenProfileCapabilities[projData.projectType]) {
                            expect(event.eventData.error);
                            expect(event.eventData.error).to.equal(`Maven settings cannot be set for a non-Maven project: ${projData.projectType}`);
                        }
                        if (setting === "mavenProperties" && !project_configs.mavenProfileCapabilities[projData.projectType]) {
                            expect(event.eventData.error);
                            expect(event.eventData.error).to.equal(`The maven properties list cannot be set for a non-Maven project: ${projData.projectType}`);
                        }
                    }
                } else {
                    fail(`failed to find ${targetEvent} for setting ${setting}`);
                }
            }
        }
    });
}
