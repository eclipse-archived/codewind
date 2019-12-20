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
import { createProject } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";
import * as utils from "../../../lib/utils";
import * as appConfigs from "../../../configs/app.config";
import * as eventConfigs from "../../../configs/event.config";
import * as logConfigs from "../../../configs/log.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { fail } from "assert";

import path from "path";
import fs from "fs";

export default class CreateTest {
    testName: string;

    constructor(testName: string) {
        this.testName = testName;
    }

    run(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string, runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(this.testName, () => {
            if (!process.env.TURBINE_PERFORMANCE_TEST) {
                this.runCreateWithoutProjectID(projData);
                this.runCreateWithoutProjectType(projData);
            }
            this.runCreateWithValidData(socket, projData, projectTemplate, projectLang);
            this.afterAllHook(socket, projData, projectTemplate, projectLang);
        });
    }

    private afterAllHook(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
        after("clear socket events for create test", () => {
            socket.clearEvents();
        });

        after("remove build from running queue", async () => {
            await utils.setBuildStatus(projData, projectTemplate, projectLang);
        });
    }

    private runCreateWithoutProjectID(projData: projectsController.ICreateProjectParams): void {
        it("create a project without projectID", async () => {
            const invalidData = _.cloneDeep(projData);
            delete invalidData.projectID;
            const info: any = await createProject(invalidData);
            expect(info).to.exist;
            expect(info.statusCode).to.exist;
            expect(info.statusCode).to.equal(400);
            expect(info.error).to.exist;
            expect(info.error.msg).to.exist;
            expect(info.error.msg).to.equal("projectID, projectType and location are required parameters");
        });
    }

    private runCreateWithoutProjectType(projData: projectsController.ICreateProjectParams): void {
        it("create a project without projectType", async () => {
            const invalidData = _.cloneDeep(projData);
            delete invalidData.projectType;
            const info: any = await createProject(invalidData);
            expect(info).to.exist;
            expect(info.statusCode).to.exist;
            expect(info.statusCode).to.equal(400);
            expect(info.error).to.exist;
            expect(info.error.msg).to.exist;
            expect(info.error.msg).to.equal("projectID, projectType and location are required parameters");
        });
    }

    runCreateWithValidData(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
        it("create project", async () => {
            process.env.IN_K8 ? await utils.checkForKubeResources(projData.projectID, false) : await utils.checkForDockerResources(projData.projectID, false);

            let dataFile, fileContent, chosenTimestamp, startTime;
            if (process.env.TURBINE_PERFORMANCE_TEST) {
                dataFile = path.resolve(__dirname, "..", "..", "..", "..", "performance-test", "data", process.env.TEST_TYPE, process.env.TURBINE_PERFORMANCE_TEST, "performance-data.json");
                fileContent = JSON.parse(await fs.readFileSync(dataFile, "utf-8"));
                chosenTimestamp = Object.keys(fileContent[projectTemplate][projectLang]).sort().pop();
                startTime = Date.now();
            }

            const info: any = await createProject(projData);
            expect(info).to.exist;
            expect(info.statusCode).to.exist;
            expect(info.statusCode).to.equal(202);
            expect(info.operationId).to.exist;
            expect(info.logs).to.exist;
            expect(info.logs.build).to.exist;

            await waitForCreationEvent(projData.projectType, projectTemplate);
            await waitForProjectStartedEvent();

            if (process.env.TURBINE_PERFORMANCE_TEST) {
                const endTime = Date.now();
                const totalTestTime = (endTime - startTime) / 1000;
                fileContent[projectTemplate][projectLang][chosenTimestamp]["create"] = totalTestTime;
                await fs.writeFileSync(dataFile, JSON.stringify(fileContent));
            }

            process.env.IN_K8 ? await utils.checkForKubeResources(projData.projectID) : await utils.checkForDockerResources(projData.projectID);
        }).timeout(timeoutConfigs.createTestTimeout);

        async function waitForCreationEvent(projectType: string, projectTemplate: string): Promise<void> {
            const targetEvent = eventConfigs.events.creation;
            const event = await utils.waitForEvent(socket, targetEvent);
            if (event) {
                expect(event);
                expect(event.eventName);
                expect(event.eventName).to.equal(targetEvent);
                expect(event.eventData);
                expect(event.eventData).to.haveOwnProperty("operationId");
                expect(event.eventData).to.haveOwnProperty("projectID");
                expect(event.eventData["projectID"]).to.equal(projData.projectID);
                expect(event.eventData).to.haveOwnProperty("status");
                expect(event.eventData["status"]).to.equal("success");
                if (!process.env.IN_K8) expect(event.eventData).to.haveOwnProperty("ignoredPaths");
                if (!process.env.IN_K8) expect(event.eventData).to.haveOwnProperty("host");
                if (process.env.IN_K8 && projectTemplate != appConfigs.codewindTemplates.odo) expect(event.eventData).to.haveOwnProperty("podName");
                if (projectTemplate != appConfigs.codewindTemplates.odo) {
                    expect(event.eventData).to.haveOwnProperty("ports");
                    expect(event.eventData["ports"]).to.haveOwnProperty("exposedPort");
                    expect(event.eventData["ports"]).to.haveOwnProperty("internalPort");
                }
                if (!process.env.IN_K8) expect(event.eventData).to.haveOwnProperty("containerId");
                if (projectTemplate === appConfigs.codewindTemplates.odo) {
                    expect(event.eventData).to.haveOwnProperty("appBaseURL");
                    expect(event.eventData).to.haveOwnProperty("compositeAppName");
                }
                expect(event.eventData).to.haveOwnProperty("logs");
                for (const logType of Object.keys(logConfigs.logTypes)) {
                    expect(event.eventData["logs"]).to.haveOwnProperty(logType);
                    expect(event.eventData["logs"][logType]).to.be.an.instanceof(Array);
                    expect(event.eventData["logs"][logType].length).to.equal(logConfigs.logFileMappings[projectTemplate][projectLang][logType].length);
                    for (let i = 0; i < event.eventData["logs"][logType].length; i++) {
                        expect(event.eventData["logs"][logType][i]).to.haveOwnProperty("origin");
                        expect(event.eventData["logs"][logType][i]["origin"]).to.equal(logConfigs.logFileMappings[projectTemplate][projectLang][logType][i]["origin"]);
                        if (event.eventData["logs"][logType][i]["origin"].toLowerCase() === "container") {
                            if (process.env.IN_K8) {
                                expect(event.eventData["logs"][logType][i]).to.haveOwnProperty("podName");
                            } else {
                                expect(event.eventData["logs"][logType][i]).to.haveOwnProperty("containerName");
                            }
                        }
                        expect(event.eventData["logs"][logType][i]).to.haveOwnProperty("files");
                        expect(event.eventData["logs"][logType][i]["files"]).to.be.an.instanceof(Array);
                        for (const file of event.eventData["logs"][logType][i]["files"]) {
                            const tokens = file.split("/");
                            const fileName = tokens[tokens.length - 1];
                            expect(_.includes(logConfigs.logFileMappings[projectTemplate][projectLang][logType][i]["files"], fileName));
                        }
                    }
                }
            } else {
                fail(`create project test failed to listen for ${targetEvent}`);
            }
        }

        async function waitForProjectStartedEvent(): Promise<void> {
            const targetEvent = eventConfigs.events.statusChanged;
            const data = {
                "projectID": projData.projectID,
                "appStatus": "started"
            };

            const event = await utils.waitForEvent(socket, targetEvent, data);
            if (event) {
                expect(event);
                expect(event.eventName);
                expect(event.eventName).to.equal(targetEvent);
                expect(event.eventData);
                expect(event.eventData).to.haveOwnProperty("projectID");
                expect(event.eventData).to.haveOwnProperty("appStatus");
                expect(event.eventData["projectID"]).to.equal(projData.projectID);
                expect(event.eventData["appStatus"]).to.equal("started");
            } else {
                fail(`create project test failed to listen for ${targetEvent}`);
            }
        }
    }
}
