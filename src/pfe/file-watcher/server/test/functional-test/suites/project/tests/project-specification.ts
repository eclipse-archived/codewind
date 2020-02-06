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
import ms from "ms";

import * as projectsController from "../../../../../src/controllers/projectsController";
import { reconfigProjectSpecification, getApplicationContainerInfoInK8, getApplicationContainerInfo } from "../../../lib/project";

import * as app_configs from "../../../configs/app.config";
import * as project_configs from "../../../configs/project.config";
import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { SocketIO } from "../../../lib/socket-io";
import { fail } from "assert";
import { Operation } from "../../../../../src/projects/operation";
import * as projectUtil from "../../../../../src/projects/projectUtil";

import * as utils from "../../../lib/utils";

export function projectSpecificationTest(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
    describe("projectSpecification function", () => {
        const data: any = {
            "projectID": projData.projectID
        };

        const mavenSettings = ["mavenProfiles", "mavenProperties"];

        const testExposedPort = "8888";
        const testContextRoot = "/hello";
        const testHealthCheck = "/health";
        const testMavenProfiles: Array<string> = ["profile1", "profile2"];
        const testMavenProperties: Array<string> = ["key1=value1", "key2=value2"];

        let defaultInternalPort: any, defaultInternalDebugPort: any;

        const combinations: any = {
            "combo1": {
                "setting": "internalPort",
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", "status", "ports"],
                "result": {
                    "projectID": projData.projectID,
                    "status": "success",
                    "ports": {}
                },
                "beforeHook": [{
                    "title": "Internal Port Test Before Hook",
                    "function": beforeHookInternalPortTest
                }],
                "afterHook": [{
                    "title": "Internal Port Test After Hook: Projects with single exposed port",
                    "function": afterHookInternalPortTestSinglePort
                },
                {
                    "title": "Internal Port Test After Hook: Reset internal port",
                    "function": afterHookInternalPortTestResetPort
                }]
            },
            "combo2": {
                "setting": "internalDebugPort",
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", "status", "ports"],
                "result": {
                    "projectID": projData.projectID,
                    "status": "success",
                    "ports": {
                        "internalDebugPort": project_configs.randomDebugPort
                    }
                },
                "beforeHook": [{
                    "title": "Internal debug port test - Before hook - Get default internal debug port",
                    "function": async function(hook: any): Promise<void> {
                        hook.timeout(timeoutConfigs.defaultTimeout);
                        if (process.env.IN_K8 || !(project_configs.debugCapabilities[projectTemplate] && project_configs.debugCapabilities[projectTemplate][projectLang])) return;
                        defaultInternalDebugPort = project_configs.defaultInternalDebugPorts[projectTemplate][projectLang];
                    }
                }],
                "afterHook": [{
                    "title": "Internal debug port test - After hook - Reset internal debug port",
                    "function": async function(hook: any): Promise<void> {
                        hook.timeout(timeoutConfigs.createTestTimeout);
                        if (process.env.IN_K8 || !(project_configs.debugCapabilities[projectTemplate] && project_configs.debugCapabilities[projectTemplate][projectLang])) return;

                        await runProjectSpecificationSettingTest(combinations["combo2"], defaultInternalDebugPort);

                        const action = project_configs.restartCapabilities[projectTemplate] && project_configs.restartCapabilities[projectTemplate][projectLang] && project_configs.restartCapabilities[projectTemplate][projectLang].includes("run") && !process.env.IN_K8 ? "restart" : "build";
                        const mode = action === "restart" ? "run" : undefined;
                        const targetEvents = action === "build" ? [eventConfigs.events.projectChanged, eventConfigs.events.statusChanged] :
                            [eventConfigs.events.restartResult, eventConfigs.events.statusChanged];
                        const targetEventDatas = [{"projectID": projData.projectID, "status": "success"}, {"projectID": projData.projectID, "appStatus": "started"}];

                        if (process.env.IN_K8 && action === "build") {
                            targetEvents.pop();
                            targetEventDatas.pop();
                        }

                        await utils.setAppStatus(projData, projectTemplate, projectLang);
                        await utils.callProjectAction(action, mode, socket, projData, targetEvents, targetEventDatas);
                        await utils.setBuildStatus(projData, projectTemplate, projectLang);
                    }
                }],
            },
            "combo3": {
                "setting": "contextRoot",
                "value":  testContextRoot,
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", "contextRoot", "status"],
                "result": {
                    "projectID": projData.projectID,
                    "status": "success",
                    "contextRoot": testContextRoot
                },
                "beforeHook": [{
                    "title": "Context Root Before Hook: Set project context root endpoint in .cw-settings",
                    "function": beforeHookContextRootTest
                }],
                "afterHook": [{
                    "title": "Context Root After Hook: Reset project context root endpoint",
                    "function": afterHookContextRootTest
                }]
            },
            "combo4": {
                "setting": "healthCheck",
                "value":  testHealthCheck,
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", "name", "healthCheck", "status"],
                "result": {
                    "projectID": projData.projectID,
                    "status": "success",
                    "healthCheck": testHealthCheck
                },
                "beforeHook": [{
                    "title": "Context Root Before Hook: Set project health check endpoint in .cw-settings",
                    "function": beforeHookHealthCheckTest
                }],
                "afterHook": [{
                    "title": "Health Check After Hook: Reset project health check endpoint",
                    "function": afterHookHealthCheckTest
                }]
            },
            "combo5": {
                "setting": mavenSettings[0],
                "value": testMavenProfiles,
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID", mavenSettings[0], "status"],
                "result": {
                    "projectID": projData.projectID,
                    "status": "success",
                    [mavenSettings[0]]: testMavenProfiles
                },
                "afterHook": [{
                    "title": "Reset maven profiles",
                    "function": afterHookMavenProfileTest
                }]
            },
            "combo6": {
                "setting": mavenSettings[1],
                "value": testMavenProperties,
                "socketEvent": eventConfigs.events.settingsChanged,
                "eventKeys": ["operationId", "projectID",  mavenSettings[1], "status"],
                "result": {
                    "projectID": projData.projectID,
                    "status": "success",
                    [mavenSettings[1]]: testMavenProperties
                },
                "afterHook": [{
                    "title": "Reset maven properties",
                    "function": afterHookMavenPropertyTest
                }]
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
                "eventKeys": ["operationId", "projectID", "ignoredPaths", "status"],
                "result": {
                    "projectID": projData.projectID,
                    "status": "success",
                    "ignoredPaths": [
                        "*/node_modules*",
                        "*/.git/*",
                        "*/.DS_Store",
                        "*/.dockerignore",
                        "*/.gitignore",
                    ]
                },
            }
        };

        afterEach("clear socket events", () => {
            socket.clearEvents();
        });

        after("set app status to running", async function (): Promise<void> {
            this.timeout(timeoutConfigs.defaultTimeout);
            if (project_configs.needManualReset[projectTemplate] && project_configs.needManualReset[projectTemplate][projectLang] && project_configs.needManualReset[projectTemplate][projectLang]["appStatus"]) {
                await utils.setAppStatus(projData, projectTemplate, projectLang);
                await utils.waitForEvent(socket, eventConfigs.events.statusChanged, {"projectID": projData.projectID, "appStatus": "started"});
                socket.clearEvents();
            }
        });

        const action = project_configs.restartCapabilities[projectTemplate] && project_configs.restartCapabilities[projectTemplate][projectLang] && project_configs.restartCapabilities[projectTemplate][projectLang].includes("run") && !process.env.IN_K8 ? "restart" : "build";
        const mode = action === "restart" ? "run" : undefined;
        const targetEvents = action === "build" ? [eventConfigs.events.projectChanged, eventConfigs.events.statusChanged] :
            [eventConfigs.events.restartResult, eventConfigs.events.statusChanged];
        const targetEventDatas = [{"projectID": projData.projectID, "status": "success"}, {"projectID": projData.projectID, "appStatus": "started"}];

        if (process.env.IN_K8 && action === "build") {
            targetEvents.pop();
            targetEventDatas.pop();
        }

        after(`${action} project ${projData.projectType}`, async function (): Promise<void> {
            this.timeout(timeoutConfigs.createTestTimeout);
            await utils.callProjectAction(action, mode, socket, projData, targetEvents, targetEventDatas);
            socket.clearEvents();
        });

        afterEach("remove build from running queue", async function (): Promise<void> {
            this.timeout(timeoutConfigs.defaultInterval);
            await utils.setBuildStatus(projData, projectTemplate, projectLang);
        });

        it("set project specification without project id", async () => {
            const testData = _.cloneDeep(data);
            delete testData["projectID"];
            const info: any = await reconfigProjectSpecification(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.error);
            expect(info.error).to.haveOwnProperty("msg");
            expect(info.error["msg"]).to.equal("BAD_REQUEST: The project id was not provided. ");
        });

        it("set project specification without project settings", async () => {
            const testData = _.cloneDeep(data);
            const info: any = await reconfigProjectSpecification(testData);
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
            const info: any = await reconfigProjectSpecification(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(202);
            expect(info.operationId);

            const targetEvent = eventConfigs.events.settingsChanged;
            const event = await utils.waitForEvent(socket, targetEvent);
            if (event) {
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
            const info: any = await reconfigProjectSpecification(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(202);
            expect(info.operationId);

            const targetEvent = eventConfigs.events.settingsChanged;
            const event = await utils.waitForEvent(socket, targetEvent);

            if (event) {
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

        for (const mavenSetting of mavenSettings) {
            it(`set project specification with numeric ${mavenSetting} array`, async () => {
                const testData = _.cloneDeep(data);
                testData["settings"] = {
                    [mavenSetting]: [1, 2, 3, 4]
                };
                const checkData: any = {
                    projectID: projData.projectID,
                    [mavenSetting]: undefined,
                    status: "failed",
                    error: `BAD_REQUEST: ${mavenSetting} must be a string array.`
                };
                const info: any = await reconfigProjectSpecification(testData);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(202);
                expect(info.operationId);

                const targetEvent = eventConfigs.events.settingsChanged;
                const event = await utils.waitForEvent(socket, targetEvent, checkData);

                if (event) {
                    expect(event);
                    expect(event.eventName);
                    expect(event.eventName).to.equal(targetEvent);
                    expect(event.eventData);
                    expect(event.eventData["operationId"]);
                    expect(event.eventData["projectID"]);
                    expect(event.eventData["projectID"]).to.equal(checkData.projectID);
                    expect(event.eventData[mavenSetting]).to.equal(checkData[mavenSetting]);
                    expect(event.eventData["status"]);
                    expect(event.eventData["status"]).to.equal(checkData.status);
                    expect(event.eventData["error"]);
                    expect(event.eventData["error"]).to.equal(checkData.error);
                } else {
                    fail(`failed to find ${targetEvent} for project specific setting for ${mavenSetting}`);
                }
            }).timeout(timeoutConfigs.defaultTimeout);
        }

        describe("configure project specifications", () => {
            _.forEach(combinations, (combo) => {
                describe(`configure ${combo["setting"]} settings`, () => {
                    _.forEach(combo["beforeHook"], (beforeHook) => {
                        const title = beforeHook.title;
                        const func = beforeHook.function;
                        before(`before hook: ${combo["setting"]} settings test | ${title}`, async function (): Promise<void> {
                            await func(this);
                        });
                    });

                    _.forEach(combo["afterHook"], (afterHook) => {
                        const title = afterHook.title;
                        const func = afterHook.function;
                        after(`after hook: ${combo["setting"]} settings test | ${title}`, async function (): Promise<void> {
                            await func(this);
                        });
                    });

                    it(`config project specification settings ${combo["setting"]}`, async () => {
                        await runProjectSpecificationSettingTest(combo);
                    }).timeout(timeoutConfigs.defaultTimeout);
                });
            });
        });

        async function runProjectSpecificationSettingTest(combo: any, valueCheck?: any): Promise<void> {
            const comboInUse = _.cloneDeep(combo);
            const setting = comboInUse["setting"];
            let value = valueCheck || comboInUse["value"];

            if (setting === "internalPort") {
                if (projectTemplate === app_configs.codewindTemplates.odo) return; // internal port settings are not available for odo projects
                const projectInfo = await projectUtil.getProjectInfo(projData.projectID);
                await projectUtil.getContainerInfo(projectInfo, true);
                const containerName = await projectUtil.getContainerName(projectInfo);
                const operation = new Operation("", projectInfo);
                operation.containerName = containerName;
                const containerInfo: any = process.env.IN_K8 ? await getApplicationContainerInfoInK8(projectInfo, operation) : await getApplicationContainerInfo(projectInfo, containerName);
                const currentInternalPort = containerInfo.internalPort;
                const portKey = process.env.IN_K8 ? "podPorts" : "containerPorts";
                const ports = project_configs.oneExposedPortOnly[projectTemplate] && project_configs.oneExposedPortOnly[projectTemplate][projectLang] && project_configs.oneExposedPortOnly[projectTemplate][projectLang][process.env.TEST_TYPE] ? containerInfo[portKey] : containerInfo[portKey].filter((val: any) => {
                    return val != currentInternalPort;
                });
                value = value || ports[Math.floor(Math.random() * ports.length)];
            }
            if (setting === "internalDebugPort") {
                if (process.env.IN_K8) return; // internal debug port setting is not supported in kube
                value = value || project_configs.randomDebugPort;
            }
            if (setting === "mavenProfiles" || setting === "mavenProperties") {
                if (!(project_configs.mavenProfileCapabilities[projectTemplate] && project_configs.mavenProfileCapabilities[projectTemplate][projectLang])) {
                    value = [];
                    comboInUse["result"]["status"] = "failed";
                    comboInUse["eventKeys"].push("error");
                    delete comboInUse["result"][setting];
                }
                // for spring and liberty project types support maven profiles we need to set the value here
            }

            const testData = _.cloneDeep(data);
            testData["settings"] = {
                [setting]: value
            };

            if (setting === "internalPort" || setting === "internalDebugPort") {
                comboInUse["result"]["ports"][setting] = value;
            } else {
                comboInUse["result"][setting] = value;
            }

            const info: any = await reconfigProjectSpecification(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(202);
            expect(info.operationId);

            if (comboInUse["socketEvent"] && comboInUse["eventKeys"] && comboInUse["result"]) {
                if (setting === "internalDebugPort" && !(project_configs.debugCapabilities[projectTemplate] && project_configs.debugCapabilities[projectTemplate][projectLang])) {
                    comboInUse["result"]["status"] = "failed";
                    comboInUse["eventKeys"].push("error");
                }

                const targetEvent = comboInUse["socketEvent"];
                const event = await utils.waitForEvent(socket, targetEvent, comboInUse["result"], comboInUse["eventKeys"]);

                if (event) {
                    expect(event);
                    expect(event.eventName);
                    expect(event.eventName).to.equal(targetEvent);
                    expect(event.eventData);

                    for (const eventKey of comboInUse["eventKeys"]) {
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

                        if (setting === "internalDebugPort" && !(project_configs.debugCapabilities[projectTemplate] && project_configs.debugCapabilities[projectTemplate][projectLang])) {
                            expect(event.eventData.error);
                            expect(event.eventData.error).to.equal(`BAD_REQUEST: The project does not support debug mode.`);
                        }
                        if (setting === "internalDebugPort" && process.env.IN_K8) {
                            expect(event.eventData.error);
                            expect(event.eventData.error).to.equal(`BAD_REQUEST: debug mode is not supported on Kubernetes.`);
                        }
                        if (setting === "mavenProfiles" && !(project_configs.mavenProfileCapabilities[projectTemplate] && project_configs.mavenProfileCapabilities[projectTemplate][projectLang])) {
                            expect(event.eventData.error);
                            expect(event.eventData.error).to.equal(`Maven settings cannot be set for a non-Maven project: ${projData.projectType}`);
                        }
                        if (setting === "mavenProperties" && !(project_configs.mavenProfileCapabilities[projectTemplate] && project_configs.mavenProfileCapabilities[projectTemplate][projectLang])) {
                            expect(event.eventData.error);
                            expect(event.eventData.error).to.equal(`The maven properties list cannot be set for a non-Maven project: ${projData.projectType}`);
                        }
                    }
                } else {
                    fail(`failed to find ${targetEvent} for setting ${setting}`);
                }
            }
        }

        async function beforeHookInternalPortTest(hook: any): Promise<void> {
            hook.timeout(timeoutConfigs.createTestTimeout);
            if (! (project_configs.oneExposedPortOnly[projectTemplate] && project_configs.oneExposedPortOnly[projectTemplate][projectLang] && project_configs.oneExposedPortOnly[projectTemplate][projectLang][process.env.TEST_TYPE])) return;

            const projectInfo = await projectUtil.getProjectInfo(projData.projectID);
            const containerName = await projectUtil.getContainerName(projectInfo);
            const operation = new Operation("", projectInfo);
            operation.containerName = containerName;
            const containerInfo: any = process.env.IN_K8 ? await getApplicationContainerInfoInK8(projectInfo, operation) : await getApplicationContainerInfo(projectInfo, containerName);
            defaultInternalPort = containerInfo.internalPort;

            const dockerfile = path.join(projData.location, "Dockerfile");
            const fileOutput = await fs.readFileSync(dockerfile, {encoding: "utf-8"});
            if (projData.projectType != "spring") {
                await fs.writeFileSync(dockerfile, fileOutput.replace(new RegExp(`EXPOSE ${defaultInternalPort}`, "g"), `EXPOSE ${testExposedPort}`), {encoding: "utf-8"});
            }

            if (process.env.IN_K8 && app_configs.templateNames[projectTemplate] && app_configs.templateNames[projectTemplate][projectLang]) {
                const projectTemplateDir = path.join(projData.location, "chart", app_configs.templateNames[projectTemplate][projectLang]);
                const files = ["values.yaml"];
                for (const file of files) {
                    const fileOutput = await fs.readFileSync(path.join(projectTemplateDir, file), {encoding: "utf-8"});
                    await fs.writeFileSync(path.join(projectTemplateDir, file), fileOutput.replace(new RegExp(`servicePort: ${defaultInternalPort}`, "g"), `servicePort: ${testExposedPort}`), {encoding: "utf-8"});
                }
            }
            // we need to do two builds for docker projects on local. issue: https://github.com/eclipse/codewind/issues/297
            if (projData.projectType === "docker" && !process.env.IN_K8) {
                await utils.callProjectAction("build", undefined, socket, projData);
            }
            await utils.callProjectAction("build", undefined, socket, projData, [eventConfigs.events.projectChanged],
                [{"projectID": projData.projectID, "status": "success", "ports": {"internalPort": testExposedPort}}]);
            await utils.setBuildStatus(projData, projectTemplate, projectLang);
            socket.clearEvents();
        }

        async function afterHookInternalPortTestSinglePort(hook: any): Promise<void> {
            hook.timeout(timeoutConfigs.createTestTimeout);
            if (! (project_configs.oneExposedPortOnly[projectTemplate] && project_configs.oneExposedPortOnly[projectTemplate][projectLang] && project_configs.oneExposedPortOnly[projectTemplate][projectLang][process.env.TEST_TYPE])) return;

            const dockerfile = path.join(projData.location, "Dockerfile");
            const fileOutput = await fs.readFileSync(dockerfile, {encoding: "utf-8"});
            if (projData.projectType != "spring") {
                await fs.writeFileSync(dockerfile, fileOutput.replace(new RegExp(`EXPOSE ${testExposedPort}`, "g"), `EXPOSE ${defaultInternalPort}`), {encoding: "utf-8"});
            }

            if (process.env.IN_K8 && app_configs.templateNames[projectTemplate] && app_configs.templateNames[projectTemplate][projectLang]) {
                const projectTemplateDir = path.join(projData.location, "chart", app_configs.templateNames[projectTemplate][projectLang]);
                const files = ["values.yaml"];
                for (const file of files) {
                    const fileOutput = await fs.readFileSync(path.join(projectTemplateDir, file), {encoding: "utf-8"});
                    await fs.writeFileSync(path.join(projectTemplateDir, file), fileOutput.replace(new RegExp(`servicePort: ${testExposedPort}`, "g"), `servicePort: ${defaultInternalPort}`), {encoding: "utf-8"});
                }
            }
            // we need to do two builds for docker projects on local. issue: https://github.com/eclipse/codewind/issues/297
            if (projData.projectType === "docker" && !process.env.IN_K8) {
                await utils.callProjectAction("build", undefined, socket, projData, [eventConfigs.events.projectChanged],
                    [{"projectID": projData.projectID, "status": "success", "ports": {"internalPort": testExposedPort}}]);
            }
            await utils.callProjectAction("build", undefined, socket, projData, [eventConfigs.events.projectChanged],
                [{"projectID": projData.projectID, "status": "success", "ports": {"internalPort": defaultInternalPort}}]);
            await utils.setBuildStatus(projData, projectTemplate, projectLang);
            socket.clearEvents();
        }

        async function afterHookInternalPortTestResetPort(hook: any): Promise<void> {
            hook.timeout(timeoutConfigs.createTestTimeout);
            if (!(project_configs.defaultInternalPorts[projectTemplate] && project_configs.defaultInternalPorts[projectTemplate][projectLang])) return;
            await runProjectSpecificationSettingTest(combinations["combo1"], project_configs.defaultInternalPorts[projectTemplate][projectLang]);

            const action = project_configs.restartCapabilities[projectTemplate] && project_configs.restartCapabilities[projectTemplate][projectLang] && project_configs.restartCapabilities[projectTemplate][projectLang].includes("run") && !process.env.IN_K8 ? "restart" : "build";
            const mode = action === "restart" ? "run" : undefined;
            const targetEvents = action === "build" ? [eventConfigs.events.projectChanged, eventConfigs.events.statusChanged] :
                [eventConfigs.events.restartResult, eventConfigs.events.statusChanged];
            const targetEventDatas = [{"projectID": projData.projectID, "status": "success"}, {"projectID": projData.projectID, "appStatus": "started"}];

            if (process.env.IN_K8 && action === "build") {
                targetEvents.pop();
                targetEventDatas.pop();
            }

            await utils.setAppStatus(projData, projectTemplate, projectLang);
            await utils.callProjectAction(action, mode, socket, projData, targetEvents, targetEventDatas);
            await utils.setBuildStatus(projData, projectTemplate, projectLang);
            socket.clearEvents();
        }

        async function beforeHookContextRootTest(hook: any): Promise<void> {
            hook.timeout(timeoutConfigs.defaultTimeout);
            const cwSettings = await readCwSettings();
            cwSettings["contextRoot"] = testContextRoot;
            await writeCwSettings(cwSettings);
        }

        async function afterHookContextRootTest(hook: any): Promise<void> {
            hook.timeout(timeoutConfigs.defaultTimeout);
            const contextRootValue = project_configs.defaultContextRoot[projectTemplate] && project_configs.defaultContextRoot[projectTemplate][projectLang] ? project_configs.defaultContextRoot[projectTemplate][projectLang] : project_configs.defaultHealthCheckEndPoint;
            const cwSettings = await readCwSettings();
            cwSettings["contextRoot"] = contextRootValue;
            await writeCwSettings(cwSettings);
            await runProjectSpecificationSettingTest(combinations["combo3"], contextRootValue);
        }

        async function beforeHookHealthCheckTest(hook: any): Promise<void> {
            hook.timeout(timeoutConfigs.defaultTimeout);
            const cwSettings = await readCwSettings();
            cwSettings["healthCheck"] = testHealthCheck;
            await writeCwSettings(cwSettings);
        }

        async function afterHookHealthCheckTest(hook: any): Promise<void> {
            hook.timeout(timeoutConfigs.defaultTimeout);
            const healthCheckValue = project_configs.defaultContextRoot[projectTemplate] && project_configs.defaultContextRoot[projectTemplate][projectLang] ? project_configs.defaultContextRoot[projectTemplate][projectLang] : project_configs.defaultHealthCheckEndPoint;
            const cwSettings = await readCwSettings();
            cwSettings["healthCheck"] = healthCheckValue;
            await writeCwSettings(cwSettings);
            await runProjectSpecificationSettingTest(combinations["combo4"], healthCheckValue);
        }

        async function afterHookMavenProfileTest(hook: any): Promise<void> {
            hook.timeout(timeoutConfigs.defaultTimeout);
            await runProjectSpecificationSettingTest(combinations["combo5"], []);
        }

        async function afterHookMavenPropertyTest(hook: any): Promise<void> {
            hook.timeout(timeoutConfigs.defaultTimeout);
            await runProjectSpecificationSettingTest(combinations["combo6"], []);
        }

        async function readCwSettings(): Promise<any> {
            const cwSettingsPath = path.join(projData.location, ".cw-settings");
            const cwSettings = JSON.parse(await fs.readFileSync(cwSettingsPath, "utf-8"));
            return cwSettings;
        }

        async function writeCwSettings(settings: any): Promise<void> {
            const cwSettingsPath = path.join(projData.location, ".cw-settings");
            return await fs.writeFileSync(cwSettingsPath, JSON.stringify(settings));
        }
    });
}
