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

import { ProjectCreation, getProjectCapabilities } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";

import { projectActionTest } from "./project-action";
import { projectSpecificationTest } from "./project-specification";

import * as app_configs from "../../../configs/app.config";

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
                expect(info.capabilities).to.deep.equal(app_configs.projectCapabilities[projectType]);
            });
        });
    }

    private runProjectActionTest(socket: SocketIO, projData: ProjectCreation): void {
        projectActionTest(socket, projData);
    }

    private runProjectSpecificationTest(socket: SocketIO, projData: ProjectCreation, projectLang: string): void {
        projectSpecificationTest(socket, projData, projectLang);
    }
}
