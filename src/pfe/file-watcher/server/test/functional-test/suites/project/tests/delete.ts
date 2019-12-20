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
import * as projectsController from "../../../../../src/controllers/projectsController";
import { deleteProject } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";
import * as utils from "../../../lib/utils";
import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { fail } from "assert";

import path from "path";
import fs from "fs";

export default class DeleteTest {
    testName: string;

    constructor(testName: string) {
        this.testName = testName;
    }

    run(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string, runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(this.testName, () => {
            if (!process.env.TURBINE_PERFORMANCE_TEST) {
                this.runDeleteWithMissingProjectID();
                this.runDeleteWithInvalidProjectID();
            }
            this.runDeleteWithValidData(socket, projData, projectTemplate, projectLang);
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

    private runDeleteWithValidData(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
        it("delete project", async () => {
            process.env.IN_K8 ? await utils.checkForKubeResources(projData.projectID) : await utils.checkForDockerResources(projData.projectID);

            let dataFile, fileContent, chosenTimestamp, startTime;
            if (process.env.TURBINE_PERFORMANCE_TEST) {
                dataFile = path.resolve(__dirname, "..", "..", "..", "..", "performance-test", "data", process.env.TEST_TYPE, process.env.TURBINE_PERFORMANCE_TEST, "performance-data.json");
                fileContent = JSON.parse(await fs.readFileSync(dataFile, "utf-8"));
                chosenTimestamp = Object.keys(fileContent[projectTemplate][projectLang]).sort().pop();
                startTime = Date.now();
            }

            const info: any = await deleteProject(projData.projectID);
            const targetEvent = eventConfigs.events.deletion;
            expect(info).to.exist;
            expect(info.statusCode).to.exist;
            expect(info.statusCode).to.equal(202);
            expect(info.operationId).to.exist;

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
            } else {
                fail(`delete project test failed to listen for ${targetEvent}`);
            }

            if (process.env.TURBINE_PERFORMANCE_TEST) {
                const endTime = Date.now();
                const totalTestTime = (endTime - startTime) / 1000;
                fileContent[projectTemplate][projectLang][chosenTimestamp]["delete"] = totalTestTime;
                await fs.writeFileSync(dataFile, JSON.stringify(fileContent));
            }

            process.env.IN_K8 ? await utils.checkForKubeResources(projData.projectID, false) : await utils.checkForDockerResources(projData.projectID, false);
        }).timeout(timeoutConfigs.createTestTimeout);
    }
}
