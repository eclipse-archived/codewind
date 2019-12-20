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
import { getProjectCapabilities } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";

import { projectActionTest } from "./project-action";
import { projectEventTest } from "./project-event";
import { projectSpecificationTest } from "./project-specification";
import { logsTest } from "./logs";
import { updateStatusTest } from "./update-status";

import * as project_configs from "../../../configs/project.config";

export default class ProjectTest {
    testName: string;

    constructor(testName: string) {
        this.testName = testName;
    }

    run(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string, runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(this.testName, () => {
            if (!process.env.TURBINE_PERFORMANCE_TEST) {
                this.runProjectActionTest(socket, projData, projectTemplate, projectLang);
                this.runProjectCapabilityTest(projData.projectID, projectTemplate, projectLang);
                this.runProjectLogsTest(socket, projData, projectTemplate, projectLang);
                this.runProjectSpecificationTest(socket, projData, projectTemplate, projectLang);
                this.runUpdateStatusTest(socket, projData, projectTemplate, projectLang);
            }
            this.runProjectEventTest(socket, projData, projectTemplate, projectLang);
        });
    }

    private runProjectCapabilityTest(projectID: string, projectTemplate: string, projectLang: string): void {
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
                expect(info.capabilities).to.deep.equal(project_configs.projectCapabilities[projectTemplate][projectLang][process.env.TEST_TYPE]);
            });
        });
    }

    private runProjectActionTest(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
        projectActionTest(socket, projData, projectTemplate, projectLang);
    }

    private runProjectSpecificationTest(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
        projectSpecificationTest(socket, projData, projectTemplate, projectLang);
    }

    private runProjectLogsTest(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
        logsTest(socket, projData, projectTemplate, projectLang);
    }

    private runUpdateStatusTest(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
        updateStatusTest(socket, projData, projectTemplate, projectLang);
    }

    private runProjectEventTest(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
        projectEventTest(socket, projData, projectTemplate, projectLang);
    }
}
