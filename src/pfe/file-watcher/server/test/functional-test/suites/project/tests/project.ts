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

import { ProjectCreation, getProjectCapabilities, getProjectLogs, projectAction } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";

import { projectActionTest } from "./project-action";
import { projectSpecificationTest } from "./project-specification";
import { updateStatusTest } from "./update-status";

import * as project_configs from "../../../configs/project.config";
import * as log_configs from "../../../configs/log.config";

export default class ProjectTest {
    testName: string;

    constructor(testName: string) {
        this.testName = testName;
    }

    run(socket: SocketIO, projData: ProjectCreation, projectLang: string, runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(this.testName, () => {
            this.runProjectCapabilityTest(projData.projectType, projData.projectID);
            this.runProjectActionTest(socket, projData);
            this.runProjectSpecificationTest(socket, projData, projectLang);
            this.runProjectLogsTest(projData);
            this.runUpdateStatusTest(socket, projData);
        });
    }

    private runProjectCapabilityTest(projectType: string, projectID: string): void {
        describe("getProjectCapabilities function", () => {
            it("get project capability with undefined project id", async () => {
                const info: any = await getProjectCapabilities(undefined);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(400);
                expect(info.error);
                expect(info.error).to.have.ownProperty("msg");
                expect(info.error["msg"]).to.equal("Bad request - no project ID specified");
            });

            it("get project capability with defined project id", async () => {
                const info: any = await getProjectCapabilities(projectID);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(200);
                expect(info.capabilities);
                expect(info.capabilities).to.deep.equal(project_configs.projectCapabilities[projectType]);
            });
        });
    }

    private runProjectActionTest(socket: SocketIO, projData: ProjectCreation): void {
        projectActionTest(socket, projData);
    }

    private runProjectSpecificationTest(socket: SocketIO, projData: ProjectCreation, projectLang: string): void {
        projectSpecificationTest(socket, projData, projectLang);
    }

    private runProjectLogsTest(projData: ProjectCreation): void {
        describe("getProjectLogs function", () => {
            it("get project logs with missing id", async () => {
                const info: any = await getProjectLogs(undefined);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(400);
                expect(info.error);
                expect(info.error).to.haveOwnProperty("msg");
                expect(info.error.msg).to.equal("Bad request");
            });

            it("get project logs with invalid id", async () => {
                const badProjectId = "1234someid";
                const info: any = await getProjectLogs(badProjectId);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(404);
                expect(info.error);
                expect(info.error).to.haveOwnProperty("msg");
                expect(info.error.msg).to.equal(`Project does not exist ${badProjectId}`);
            });

            it("get project logs with valid id", async () => {
                const info: any = await getProjectLogs(projData.projectID);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(200);
                expect(info.logs);
                expect(info.logs).to.haveOwnProperty("build");
                expect(info.logs.build).to.haveOwnProperty("origin");
                expect(info.logs.build).to.haveOwnProperty("files");
                expect(info.logs.build.files[0].indexOf(projData.projectID) > -1);
                expect(info.logs).to.haveOwnProperty("app");
                expect(info.logs.app).to.haveOwnProperty("origin");
                expect(info.logs.app).to.haveOwnProperty("files");
                expect(info.logs.app.files[0].indexOf(projData.projectID) > -1);

                if (log_configs.logFileMappings[projData.projectType]) {
                    const actualBuildLogFiles = log_configs.logFileMappings[projData.projectType].build;
                    const actualAppLogFiles = log_configs.logFileMappings[projData.projectType].app;

                    const expectedBuildLogFiles = info.logs.build.files;
                    for (const logFile of expectedBuildLogFiles) {
                        const tokens = logFile.split("/");
                        const fileName = tokens[tokens.length - 1];
                        expect(_.includes(actualBuildLogFiles, fileName));
                    }

                    const expectedAppLogFiles = info.logs.app.files;
                    for (const logFile of expectedAppLogFiles) {
                        const tokens = logFile.split("/");
                        const fileName = tokens[tokens.length - 1];
                        expect(_.includes(actualAppLogFiles, fileName));
                    }
                }
            });
        });
    }

    private runUpdateStatusTest(socket: SocketIO, projData: ProjectCreation): void {
        updateStatusTest(socket, projData);
    }
}
