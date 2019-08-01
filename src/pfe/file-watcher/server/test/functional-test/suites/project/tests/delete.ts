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
import { expect } from "chai";
import { deleteProject } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";
import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { fail } from "assert";

export default class DeleteTest {
    testName: string;

    constructor(testName: string) {
        this.testName = testName;
    }

    run(socket: SocketIO, projectID: string, runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(this.testName, () => {
            this.runDeleteWithMissingProjectID();
            this.runDeleteWithInvalidProjectID();
            this.runDeleteWithValidData(socket, projectID);
            this.afterAllHook(socket);
        });
    }

    private afterAllHook(socket: SocketIO): void {
        after("clear socket events for create test", () => {
            socket.clearEvents();
        });
    }

    private runDeleteWithMissingProjectID(): void {
        it("delete a project with missing id", async () => {
            const invalidId: any = undefined;
            const info: any = await deleteProject(invalidId);
            expect(info).to.exist;
            expect(info.statusCode).to.exist;
            expect(info.statusCode).to.equal(400);
            expect(info.error).to.exist;
            expect(info.error.msg).to.exist;
            expect(info.error.msg).to.equal(`Bad request`);
        });
    }

    private runDeleteWithInvalidProjectID(): void {
        it("delete a project with invalid id", async () => {
            const invalidId = "invalidId";
            const info: any = await deleteProject(invalidId);
            expect(info).to.exist;
            expect(info.statusCode).to.exist;
            expect(info.statusCode).to.equal(404);
            expect(info.error).to.exist;
            expect(info.error.msg).to.exist;
            expect(info.error.msg).to.equal(`Project does not exist ${invalidId}`);
        });
    }

    private runDeleteWithValidData(socket: SocketIO, projectID: string): void {
        it("delete project", async () => {
            const info: any = await deleteProject(projectID);
            const targetEvent = eventConfigs.events.deletion;
            expect(info).to.exist;
            expect(info.statusCode).to.exist;
            expect(info.statusCode).to.equal(202);
            expect(info.operationId).to.exist;

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
                }, timeoutConfigs.deleteEventInterval);
            });

            if (eventFound && event) {
                expect(event);
                expect(event.eventName);
                expect(event.eventName).to.equal(targetEvent);
                expect(event.eventData);
                expect(event.eventData).to.haveOwnProperty("operationId");
                expect(event.eventData).to.haveOwnProperty("projectID");
                expect(event.eventData["projectID"]).to.equal(projectID);
                expect(event.eventData).to.haveOwnProperty("status");
                expect(event.eventData["status"]).to.equal("success");
            } else {
                fail(`delete project test failed to listen for ${targetEvent}`);
            }
        }).timeout(timeoutConfigs.createTestTimeout);
    }
}
