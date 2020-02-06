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

import * as projectsController from "../../../../../src/controllers/projectsController";
import { performProjectAction } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";

import { codewindTemplates } from "../../../configs/app.config";
import * as project_configs from "../../../configs/project.config";
import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { fail } from "assert";

import * as utils from "../../../lib/utils";

export function projectActionTest(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
    const data: any = {
        action: "restart",
        projectType: projData.projectType,
        location: projData.location,
        projectID: projData.projectID,
    };

    const combinations: any = {
        "combo1": {
            "action": "disableautobuild",
            "returnKeys": ["statusCode", "status"],
            "statusCode": 200,
            "socketEvent": process.env.IN_K8 || !(project_configs.autoBuildEventCapabailities[projectTemplate] && project_configs.autoBuildEventCapabailities[projectTemplate][projectLang]) ? [] : [eventConfigs.events.projectChanged],
            "eventKeys": process.env.IN_K8 || !(project_configs.autoBuildEventCapabailities[projectTemplate] && project_configs.autoBuildEventCapabailities[projectTemplate][projectLang])  ? [] : [["operationId", "projectID", "ignoredPaths", "status", "host", "ports", "containerId", "logs"]],
            "result": process.env.IN_K8 || !(project_configs.autoBuildEventCapabailities[projectTemplate] && project_configs.autoBuildEventCapabailities[projectTemplate][projectLang])  ? [] : [{
                "projectID": projData.projectID,
                "status": "success"
            }]
        },
        "combo2": {
            "action": "enableautobuild",
            "returnKeys": ["statusCode", "status"],
            "statusCode": 202,
            "socketEvent": process.env.IN_K8 || !(project_configs.autoBuildEventCapabailities[projectTemplate] && project_configs.autoBuildEventCapabailities[projectTemplate][projectLang])  ? [] : [eventConfigs.events.projectChanged, eventConfigs.events.statusChanged],
            "eventKeys": process.env.IN_K8 || !(project_configs.autoBuildEventCapabailities[projectTemplate] && project_configs.autoBuildEventCapabailities[projectTemplate][projectLang])  ? [] : [["operationId", "projectID", "ignoredPaths", "status", "host", "ports", "containerId", "logs"], ["projectID", "appStatus"]],
            "result": process.env.IN_K8 || !(project_configs.autoBuildEventCapabailities[projectTemplate] && project_configs.autoBuildEventCapabailities[projectTemplate][projectLang])  ? [] : [{
                "projectID": projData.projectID,
                "status": "success"
            }, {
                "projectID": projData.projectID,
                "appStatus": "started",
            }],
            "afterHook": [afterHookRemoveProjectFromRunningBuild]
        },
        "combo3": {
            "action": "validate",
            "returnKeys": ["operationId", "status"],
            "statusCode": 202,
            "socketEvent": [eventConfigs.events.projectValidated],
            "eventKeys": [["operationId", "projectType", "location", "projectID", "status", "results"]],
            "result": [{
                "projectType": projData.projectType,
                "location": projData.location,
                "projectID": projData.projectID,
                "status": "success"
            }]
        },
        "combo4": {
            "action": "build",
            "returnKeys": ["operationId", "status"],
            "statusCode": 202,
            "socketEvent": [eventConfigs.events.projectChanged],
            "eventKeys": [["projectID", "status"]],
            "result": [{
                "projectID": projData.projectID,
                "status": "success",
            }],
            "afterHook": [afterHookRemoveProjectFromRunningBuild]
        },
    };

    if (project_configs.restartCapabilities[projectTemplate] && project_configs.restartCapabilities[projectTemplate][projectLang]) {
        _.forEach(project_configs.restartCapabilities[projectTemplate][projectLang], (restartCapability) => {
            combinations[`restart_${restartCapability}`] = {
                "action": "restart",
                "mode": restartCapability,
                "returnKeys": ["operationId", "status"],
                "statusCode": 202,
                "socketEvent": [eventConfigs.events.restartResult],
                "eventKeys": [["operationId", "projectID", "status", "startMode", "ports"]],
                "result" : [{
                    "projectID": projData.projectID,
                    "status": "success"
                }],
                "beforeHook": [
                    async function(hook: any): Promise<void> {
                        hook.timeout(timeoutConfigs.defaultTimeout);
                        await utils.setAppStatus(projData, projectTemplate, projectLang);
                        socket.clearEvents();
                    }
                ],
                "afterHook": [
                    async function(hook: any): Promise<void> {
                        hook.timeout(timeoutConfigs.createTestTimeout);
                        await utils.setAppStatus(projData, projectTemplate, projectLang);
                        socket.clearEvents();

                        const comboInUse = _.cloneDeep(combinations[`restart_${restartCapability}`]);
                        comboInUse.socketEvent.push(eventConfigs.events.statusChanged);
                        comboInUse.eventKeys.push(["projectID", "appStatus"]);
                        comboInUse.result.push({
                            "projectID": projData.projectID,
                            "appStatus": "started",
                        });
                        await setProjectActionTest(comboInUse, "run");
                        socket.clearEvents();
                    }
                ]
            };
        });
    }

    describe("projectAction function", () => {
        afterEach("clear socket events", () => {
            socket.clearEvents();
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

        after("set app status to running", async function (): Promise<void> {
            this.timeout(timeoutConfigs.defaultTimeout);
            if (project_configs.needManualReset[projectTemplate] && project_configs.needManualReset[projectTemplate][projectLang] && project_configs.needManualReset[projectTemplate][projectLang]["appStatus"] && action === "restart") {
                await utils.setAppStatus(projData, projectTemplate, projectLang);
                await utils.waitForEvent(socket, eventConfigs.events.statusChanged, {"projectID": projData.projectID, "appStatus": "started"});
                socket.clearEvents();
            }
        });

        after(`${action} project ${projData.projectType}`, async function (): Promise<void> {
            this.timeout(timeoutConfigs.createTestTimeout);
            await utils.callProjectAction(action, mode, socket, projData, targetEvents, targetEventDatas);
        });

        after("remove build from running queue", async function (): Promise<void> {
            this.timeout(timeoutConfigs.defaultInterval);
            await utils.setBuildStatus(projData, projectTemplate, projectLang);
        });

        it("set project action with undefined action type", async () => {
            const testData = _.cloneDeep(data);
            testData["action"] = "someAction";
            const info: any = await performProjectAction(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(400);
            expect(info.error);
            expect(info.error).to.haveOwnProperty("msg");
            expect(info.error["msg"]).to.equal(`Unknown action requested: ${testData.action}`);
        });

        _.forEach(combinations, (combo) => {
            describe(`configure project action ${combo["action"]}`, () => {
                setProjectActionDescribe(combo, combo["mode"]);
            });
        });
    });

    function setProjectActionDescribe(combo: any, mode?: string): void {
        _.forEach(combo["beforeHook"], (beforeHook) => {
            before(`before hook: ${combo["setting"]} settings test`, async function (): Promise<void> {
                await beforeHook(this);
            });
        });

        _.forEach(combo["afterHook"], (afterHook) => {
            after(`after hook: ${combo["setting"]} settings test`, async function (): Promise<void> {
                await afterHook(this);
            });
        });

        const comboInUse = _.cloneDeep(combo);
        if (mode === "run") {
            comboInUse.socketEvent.push(eventConfigs.events.statusChanged);
            comboInUse.eventKeys.push(["projectID", "appStatus"]);
            comboInUse.result.push({
                "projectID": projData.projectID,
                "appStatus": "started",
            });
        }
        setProjectActionIt(comboInUse, mode);
    }

    function setProjectActionIt(combo: any, mode?: string): void {
        let testMessage = `set project action to ${combo.action}`;
        testMessage = mode ? testMessage + ` with mode ${mode}` : testMessage;
        it(testMessage, async () => {
            await setProjectActionTest(combo, mode);
        }).timeout(timeoutConfigs.createTestTimeout);
    }

    async function setProjectActionTest(combo: any, mode?: string): Promise<void> {
        const comboInUse = _.cloneDeep(combo);

        if (comboInUse.action.toLowerCase() === "restart" && process.env.IN_K8) {
            comboInUse.statusCode = 400;
            delete comboInUse.returnKeys;
            delete comboInUse.socketEvent;
            delete comboInUse.eventKeys;
            delete comboInUse.result;
        }

        const testData = _.cloneDeep(data);
        testData["action"] = comboInUse.action;

        if (mode) {
            testData["startMode"] = mode;
        }

        const info: any = await performProjectAction(testData);
        expect(info);

        if (comboInUse["returnKeys"]) {
            for (const returnKey of comboInUse["returnKeys"]) {
                expect(info[returnKey]);
            }
        }

        expect(info.statusCode);
        expect(info.statusCode).to.equal(comboInUse.statusCode);

        if (comboInUse["status"]) {
            expect(info.status);
            expect(info.status).to.equal(comboInUse.status);
        }

        const socketEvents = comboInUse["socketEvent"];
        const eventKeys = comboInUse["eventKeys"];
        const results = comboInUse["result"];

        if (socketEvents && socketEvents.length > 0 && eventKeys && eventKeys.length > 0 && results && results.length > 0) {
            expect(socketEvents.length).to.equal(eventKeys.length);
            expect(eventKeys.length).to.equal(results.length);

            for (const socketEvent of socketEvents) {
                const index = socketEvents.indexOf(socketEvent);
                const eventKey = eventKeys[index];
                const result = results[index];
                const targetEvent = socketEvent;
                const event = await utils.waitForEvent(socket, targetEvent, result, eventKey);
                if (event) {
                    expect(event);
                    expect(event.eventName);
                    expect(event.eventName).to.equal(targetEvent);
                    expect(event.eventData);

                    for (const key of eventKey) {
                        expect(event.eventData).to.haveOwnProperty(key);
                        if (key === "projectID") {
                            expect(event.eventData[key]).to.equal(projData.projectID);
                        }
                        if (key === "projectType") {
                            expect(event.eventData[key]).to.equal(projData.projectType);
                        }
                        if (key === "location") {
                            expect(event.eventData[key]).to.equal(projData.location);
                        }
                        if (key === "appStatus") {
                            expect(event.eventData[key]).to.equal("started");
                        }
                        if (key === "startMode") {
                            expect(event.eventData[key]).to.equal(mode);
                        }
                    }
                } else {
                    fail(`failed to find ${targetEvent} for action ${combo.action}`);
                }
            }
        }
    }

    async function afterHookRemoveProjectFromRunningBuild(hook: any): Promise<void> {
        hook.timeout(timeoutConfigs.defaultTimeout);
        await utils.setBuildStatus(projData, projectTemplate, projectLang);
    }
}
