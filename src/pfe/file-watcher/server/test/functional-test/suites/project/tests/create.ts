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

import { ProjectCreation, createProject } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";
import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { fail } from "assert";

export default class CreateTest {
    testName: string;

    constructor(testName: string) {
        this.testName = testName;
    }

    run(socket: SocketIO, projData: ProjectCreation, runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(this.testName, () => {
            this.runCreateWithoutProjectID(projData);
            this.runCreateWithoutProjectType(projData);
            this.runCreateWithValidData(socket, projData);
            this.afterAllHook(socket);
        });
    }

    private afterAllHook(socket: SocketIO): void {
        after("clear socket events for create test", () => {
            socket.clearEvents();
        });
    }

    private runCreateWithoutProjectID(projData: ProjectCreation): void {
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

    private runCreateWithoutProjectType(projData: ProjectCreation): void {
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

    runCreateWithValidData(socket: SocketIO, projData: ProjectCreation): void {
        it("create project", async () => {
            const info: any = await createProject(projData);
            const targetEvent = eventConfigs.events.creation;
            expect(info).to.exist;
            expect(info.statusCode).to.exist;
            expect(info.statusCode).to.equal(202);
            expect(info.operationId).to.exist;
            expect(info.logs).to.exist;
            expect(info.logs.build).to.exist;

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
                }, timeoutConfigs.createEventInterval);
            });

            if (eventFound && event) {
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
                if (process.env.IN_K8) expect(event.eventData).to.haveOwnProperty("podName");
                expect(event.eventData).to.haveOwnProperty("ports");
                expect(event.eventData["ports"]).to.haveOwnProperty("exposedPort");
                expect(event.eventData["ports"]).to.haveOwnProperty("internalPort");
                if (!process.env.IN_K8) expect(event.eventData).to.haveOwnProperty("containerId");
                expect(event.eventData).to.haveOwnProperty("logs");
                expect(event.eventData["logs"]).to.haveOwnProperty("build");
                expect(event.eventData["logs"]["build"]).to.haveOwnProperty("origin");
                expect(event.eventData["logs"]["build"]).to.haveOwnProperty("files");
                expect(event.eventData["logs"]).to.haveOwnProperty("app");
                expect(event.eventData["logs"]["app"]).to.haveOwnProperty("origin");
                expect(event.eventData["logs"]["app"]).to.haveOwnProperty("files");
            } else {
                fail(`create project test failed to listen for ${targetEvent}`);
            }
        }).timeout(timeoutConfigs.createTestTimeout);
    }
}
