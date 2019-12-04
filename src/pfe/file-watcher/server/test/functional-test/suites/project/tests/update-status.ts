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
import { updateStatus } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";

import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import * as project_configs from "../../../configs/project.config";
import { fail } from "assert";

import * as utils from "../../../lib/utils";
import { codewindTemplates } from "../../../configs/app.config";

export function updateStatusTest(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
    describe("updateStatus function", () => {
        const projectID = projData.projectID;
        const data: any = {
            "projectID": projectID,
        };

        afterEach("remove build from running queue", async () => {
            await utils.setBuildStatus(projData, projectTemplate, projectLang);
        });

        it("update project status with missing type", async () => {
            const testData = _.cloneDeep(data);
            const info: any = await updateStatus(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(400);
            expect(info.error);
            expect(info.error).to.haveOwnProperty("msg");
            expect(info.error.msg).to.equal("Missing required status type parameter");
        });

        it("update project status with invalid type", async () => {
            const testData = _.cloneDeep(data);
            testData["type"] = "sometype";
            const info: any = await updateStatus(testData);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(400);
            expect(info.error);
            expect(info.error).to.haveOwnProperty("msg");
            expect(info.error.msg).to.equal(`Unrecognized status type: ${testData.type}`);
        });

        const statusTypes: any = {
            "application": {
                "name": "appState",
                "requiredKeys": ["projectID", "status"],
                "statusKeys": ["status"],
                "parameters": ["projectID", "status", "error"],
                "values": [projectID],
                "states": ["unknown", "stopping", "stopped", "starting", "started"],
                "eventKeys": ["projectID", "appStatus", "detailedAppStatus"],
                "result": {
                    "projectID": projectID
                }
            },
            "build": {
                "name": "buildState",
                "requiredKeys": ["projectID", "buildStatus"],
                "statusKeys": ["buildStatus"],
                "parameters": ["projectID", "buildStatus", "detailedBuildStatus", "appImageLastBuild", "buildImageLastBuild"],
                "values": [projectID],
                "states": ["unknown", "queued", "inProgress", "success", "failed"],
                "eventKeys": ["projectID", "buildStatus", "detailedBuildStatus", "appImageLastBuild", "buildImageLastBuild"],
                "result": {
                    "projectID": projectID
                }
            }
        };

        const errMsg = "Creating image for build failed";

        for (const statusType of Object.keys(statusTypes)) {
            describe(`${statusType} status update`, () => {
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
                });

                after("remove build from running queue", async () => {
                    await utils.setBuildStatus(projData, projectTemplate, projectLang);
                });

                const testData = _.cloneDeep(data);
                testData["type"] = statusTypes[statusType]["name"];

                for (const key of statusTypes[statusType]["requiredKeys"]) {
                    it(`update ${statusType} status without ${key}`, async() => {
                        const itData = _.cloneDeep(testData);
                        delete itData[key];
                        const info: any = await updateStatus(itData);
                        expect(info);
                        expect(info.statusCode);
                        expect(info.statusCode).to.equal(400);
                        expect(info.error);
                        expect(info.error).to.haveOwnProperty("msg");
                        expect(info.error.msg).to.equal(`Missing request parameters projectID or status for ${statusType} state update`);
                   });
                }

                for (const key of statusTypes[statusType]["statusKeys"]) {
                    it(`update ${statusType} status with invalid status`, async () => {
                        const itData = _.cloneDeep(testData);
                        itData[key] = "invalidstatus";
                        const info: any = await updateStatus(itData);
                        expect(info);
                        expect(info.statusCode);
                        expect(info.statusCode).to.equal(400);
                        expect(info.error);
                        expect(info.error).to.haveOwnProperty("msg");
                        expect(info.error.msg).to.equal(`Invalid ${statusType} state: ${itData[key]}`);
                    });
                }

                for (const state of statusTypes[statusType]["states"]) {
                    const values = _.cloneDeep(statusTypes[statusType]["values"]);
                    values.push(state);
                    values.push(errMsg);

                    if (statusType === "build") {
                        values.push(Date.now()); // appImageLastBuild value
                        values.push(Date.now() + 1000); // buildImageLastBuild value
                    }

                    it(`update ${statusType} status to ${state} state`, async () => {
                        const eventKeys = _.cloneDeep(statusTypes[statusType]["eventKeys"]);
                        if (statusType === "build" && (state ===  "success" || state === "failed")) {
                            eventKeys.push("lastbuild");
                        }

                        let itData = _.cloneDeep(testData);
                        itData = makeStatusUpdateObj(itData, statusTypes[statusType]["parameters"], values);

                        const result = _.cloneDeep(statusTypes[statusType]["result"]);
                        result[eventKeys[1]] = state;

                        const info: any = await updateStatus(itData);
                        expect(info);
                        expect(info.statusCode).to.equal(200);

                        if (eventKeys) {
                            const targetEvent = eventConfigs.events.statusChanged;
                            const event = await utils.waitForEvent(socket, targetEvent, result, eventKeys);

                            if (event) {
                                expect(event);
                                expect(event.eventName);
                                expect(event.eventName).to.equal(targetEvent);
                                expect(event.eventData);

                                for (const eventKey of eventKeys) {
                                    expect(event.eventData).to.haveOwnProperty(eventKey);
                                    if (eventKey === "projectID") {
                                        expect(event.eventData[eventKey]).to.equal(projectID);
                                    }
                                    if (eventKey === "appStatus" || eventKey === "buildStatus") {
                                        expect(event.eventData[eventKey]).to.equal(state);
                                    }
                                    if (eventKey === "appErrorStatus" || eventKey === "detailedBuildStatus") {
                                        expect(event.eventData[eventKey]).to.equal(errMsg);
                                    }
                                }
                            } else {
                                fail(`failed to find ${targetEvent} for state ${state}`);
                            }
                        }
                    }).timeout(timeoutConfigs.defaultTimeout);
                }
            });
        }

        function makeStatusUpdateObj(statusObj: any, parameters: Array<string>, values: Array<string>): any {
            const obj = _.cloneDeep(statusObj);
            expect(parameters.length).to.equal(values.length);
            for (let i = 0; i < parameters.length; i++) {
                obj[parameters[i]] = values[i];
            }
            return obj;
        }
    });
}
