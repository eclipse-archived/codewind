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

import { ProjectCreation, projectAction } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";

import * as project_configs from "../../../configs/project.config";
import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { fail } from "assert";

import * as utils from "../../../lib/utils";

export function projectActionTest(socket: SocketIO, projData: ProjectCreation): void {
    const data: any = {
        action: "restart",
        projectType: projData.projectType,
        location: projData.location,
        projectID: projData.projectID,
    };

    const startModes = project_configs.startModes;

    const combinations: any = {
        "combo1": {
            "action": "disableautobuild",
            "returnKeys": ["statusCode", "status"],
            "statusCode": 200,
            "socketEvent": process.env.IN_K8  || !project_configs.autoBuildEventCapabailities[projData.projectType] ? [] : [eventConfigs.events.projectChanged],
            "eventKeys": process.env.IN_K8  || !project_configs.autoBuildEventCapabailities[projData.projectType] ? [] : [["operationId", "projectID", "ignoredPaths", "status", "host", "ports", "containerId", "logs"]],
            "result": process.env.IN_K8  || !project_configs.autoBuildEventCapabailities[projData.projectType] ? [] : [{
                "projectID": projData.projectID,
                "status": "success"
            }]
        },
        "combo2": {
            "action": "enableautobuild",
            "returnKeys": ["statusCode", "status"],
            "statusCode": 202,
            "socketEvent": process.env.IN_K8  || !project_configs.autoBuildEventCapabailities[projData.projectType] ? [] : [eventConfigs.events.projectChanged, eventConfigs.events.statusChanged],
            "eventKeys": process.env.IN_K8  || !project_configs.autoBuildEventCapabailities[projData.projectType] ? [] : [["operationId", "projectID", "ignoredPaths", "status", "host", "ports", "containerId", "logs"], ["projectID", "appStatus"]],
            "result": process.env.IN_K8  || !project_configs.autoBuildEventCapabailities[projData.projectType] ? [] : [{
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
        "combo5": {
            "action": "restart",
            "returnKeys": ["operationId", "status"],
            "statusCode": 202,
            "socketEvent": [eventConfigs.events.restartResult, eventConfigs.events.statusChanged],
            "eventKeys": [["operationId", "projectID", "status", "startMode", "ports"], ["projectID", "appStatus"]],
            "result" : [{
                "projectID": projData.projectID,
                "status": "success"
            }, {
                "projectID": projData.projectID,
                "appStatus": "started",
            }]
        }
    };

    describe("projectAction function", () => {
        afterEach("clear socket events", () => {
            socket.clearEvents();
        });

        after("restart in run mode to reset the app", async () => {
            if (project_configs.restartCapabilities[projData.projectType]["run"]) {
                setProjectActionTest(combinations["combo5"], "run");
            }
        });

        utils.rebuildProjectAfterHook(socket, projData, eventConfigs.events.projectChanged, {"projectID": projData.projectID, "status": "success"});

        after("remove build from running queue", async () => {
            await utils.setBuildStatus(projData);
        });

        it("set project action with undefined action type", async () => {
            const testData = _.cloneDeep(data);
            testData["action"] = "someAction";
            const info: any = await projectAction(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(400);
            expect(info.error);
            expect(info.error).to.haveOwnProperty("msg");
            expect(info.error["msg"]).to.equal(`Unknown action requested: ${testData.action}`);
        });

        _.forEach(combinations, (combo) => {
            describe(`configure project action ${combo.action}`, () => {
                _.forEach(combo["afterHook"], (afterHook) => {
                    after(`after hook: ${combo["setting"]} settings test`, async function (): Promise<void> {
                        await afterHook(this);
                    });
                });

                if (combo.action.toLowerCase() === "restart") {
                    _.forEach(startModes, (mode) => {
                        if (!(project_configs.restartCapabilities[projData.projectType] && project_configs.restartCapabilities[projData.projectType][mode][mode]))  return;
                        setProjectActionTest(combo, mode);
                    });
                } else {
                    setProjectActionTest(combo);
                }
            });
        });

        function setProjectActionTest(combo: any, mode?: string): void {
            let testMessage = `set project action to ${combo.action}`;
            testMessage = mode ? testMessage + ` with mode ${mode}` : testMessage;
            let timeoutTime = timeoutConfigs.defaultTimeout;
            if (combo.action === "build") {
                timeoutTime = timeoutConfigs.createTestTimeout;
            }
            it(testMessage, async () => {
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

                const info: any = await projectAction(testData);
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
                        let eventFound = false;
                        let event: any;
                        await new Promise((resolve) => {
                            const timer = setInterval(() => {
                                const events = socket.getAllEvents();
                                if (events && events.length >= 1) {
                                    event =  events.filter((value) => {
                                        if (value.eventName === targetEvent && _.difference(eventKey, Object.keys(value.eventData)).length === 0
                                        && _.isMatch(value.eventData, result)) {
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
                                    const expectedMode = mode === "debug" ? "debugNoInit" : mode;
                                    expect(event.eventData[key]).to.equal(expectedMode);
                                }
                            }
                        } else {
                            fail(`failed to find ${targetEvent} for action ${combo.action}`);
                        }
                    }
                }
            }).timeout(timeoutTime);
        }
    });

    async function afterHookRemoveProjectFromRunningBuild(hook: any): Promise<void> {
        hook.timeout(timeoutConfigs.defaultTimeout);
        await utils.setBuildStatus(projData);
    }
}
