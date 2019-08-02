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

import * as app_configs from "../../../configs/app.config";
import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { fail } from "assert";

export function projectActionTest(socket: SocketIO, projData: ProjectCreation): void {
    const data: any = {
        action: "restart",
        projectType: projData.projectType,
        location: projData.location,
        projectID: projData.projectID,
    };

    const startModes = ["run", "debug"];

    const combinations: any = {
        "combo1": {
            "action": "disableautobuild",
            "returnKeys": ["statusCode", "status"],
            "statusCode": 200,
        },
        "combo2": {
            "action": "enableautobuild",
            "returnKeys": ["statusCode", "status"],
            "statusCode": 202,
        },
        "combo3": {
            "action": "validate",
            "returnKeys": ["operationId", "status"],
            "statusCode": 202,
            "socketEvent": eventConfigs.events.projectValidated,
            "eventKeys": ["operationId", "projectType", "location", "projectID", "status", "results"],
            "result": {
                "projectType": projData.projectType,
                "location": projData.location,
                "projectID": projData.projectID,
                "status": "success"
            }
        },
        "combo4": {
            "action": "build",
            "returnKeys": ["operationId", "status"],
            "statusCode": 202,
            "socketEvent": eventConfigs.events.statusChanged,
            "eventKeys": ["projectID", "appStatus", "detailedAppStatus"],
            "result": {
                "projectID": projData.projectID,
                "appStatus": "started",
            }
        },
        "combo5": {
            "action": "restart",
            "returnKeys": ["operationId", "status"],
            "statusCode": 202,
            "socketEvent": eventConfigs.events.restartResult,
            "eventKeys": ["operationId", "projectID", "status", "startMode", "ports"],
            "result": {
                "projectID": projData.projectID,
                "status": "success"
            }
        },
        "combo6": {
            "action": "restart",
            "returnKeys": ["operationId", "status"],
            "statusCode": 202,
            "socketEvent": eventConfigs.events.statusChanged,
            "eventKeys": ["projectID", "appStatus", "detailedAppStatus"],
            "result": {
                "projectID": projData.projectID,
                "appStatus": "started",
            }
        }
    };

    describe("projectAction function", () => {
        afterEach("clear socket events", () => {
            socket.clearEvents();
        });

        after("restart in run mode to reset the app", async () => {
            if (app_configs.restartCapabilities[projData.projectType]) {
                setProjectActionTest(combinations["combo5"], "run");
            }
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
            if (combo.action.toLowerCase() === "restart") {
                if (!app_configs.restartCapabilities[projData.projectType]) return;
                for (const mode of startModes) {
                    setProjectActionTest(combo, mode);
                }
            } else {
                setProjectActionTest(combo);
            }
        });

        function setProjectActionTest(combo: any, mode?: string): void {
            let testMessage = `set project action to ${combo.action}`;
            testMessage = mode ? testMessage + ` with mode ${mode}` : testMessage;

            it(testMessage, async () => {
                const testData = _.cloneDeep(data);
                testData["action"] = combo.action;

                if (mode) {
                    testData["startMode"] = mode;
                }

                const info: any = await projectAction(testData);
                expect(info);
                for (const returnKey of combo["returnKeys"]) {
                    expect(info[returnKey]);
                }
                expect(info.statusCode);
                expect(info.statusCode).to.equal(combo.statusCode);

                if (combo["status"]) {
                    expect(info.status);
                    expect(info.status).to.equal(combo.status);
                }

                if (combo["socketEvent"] && combo["eventKeys"]) {
                    const targetEvent = combo["socketEvent"];
                    let eventFound = false;
                    let event: any;
                    await new Promise((resolve) => {
                        const timer = setInterval(() => {
                            const events = socket.getAllEvents();
                            if (events && events.length >= 1) {
                                event =  events.filter((value) => {
                                    if (value.eventName === targetEvent && _.isEqual(Object.keys(value.eventData), combo["eventKeys"]) && _.isMatch(value.eventData, combo["result"])) {
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

                        for (const eventKey of combo["eventKeys"]) {
                            expect(event.eventData).to.haveOwnProperty(eventKey);
                            if (eventKey === "projectID") {
                                expect(event.eventData[eventKey]).to.equal(projData.projectID);
                            }
                            if (eventKey === "projectType") {
                                expect(event.eventData[eventKey]).to.equal(projData.projectType);
                            }
                            if (eventKey === "location") {
                                expect(event.eventData[eventKey]).to.equal(projData.location);
                            }
                            if (eventKey === "appStatus") {
                                expect(event.eventData[eventKey]).to.equal("started");
                            }
                            if (eventKey === "startMode") {
                                const expectedMode = mode === "debug" ? "debugNoInit" : mode;
                                expect(event.eventData[eventKey]).to.equal(expectedMode);
                            }
                        }
                    } else {
                        fail(`failed to find ${targetEvent} for action ${combo.action}`);
                    }
                }
            }).timeout(timeoutConfigs.defaultTimeout);
        }
    });
}
