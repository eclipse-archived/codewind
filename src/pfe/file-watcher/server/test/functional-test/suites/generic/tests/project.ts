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
import path from "path";

import * as genericLib from "../../../lib/generic";

import * as app_configs from "../../../configs/app.config";

export default class ProjectTest {
    testName: string;

    constructor(testName: string) {
        this.testName = testName;
    }

    run(runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(this.testName, () => {
            this.runGetProjectTypes();
        });
    }

    private runGetProjectTypes(runOnly?: boolean): void {
        (runOnly ? describe.only : describe)("getProjectTypes function", () => {
            it("get project type without a location", async () => {
                const info: any = await genericLib.getProjectTypes();
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(200);
                expect(info.types);
                expect(info.types).to.deep.equal(["liberty", "spring", "swift", "nodejs", "docker"]); // later just check it with the app config list of project types
            });

            it("get project type with a defined project location", async () => {
                const projectType = "spring";
                const info: any = await genericLib.getProjectTypes(path.join(app_configs.codewindWorkspaceDir, app_configs.projectPrefix + `${app_configs.codewindTemplates.default}-${projectType}`));
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(200);
                expect(info.types);
                expect(info.types).to.deep.equal([projectType]);
            });

            it("get project type with an undefined project location", async () => {
                const info: any = await genericLib.getProjectTypes(app_configs.codewindWorkspaceDir);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(200);
                expect(info.types);
                expect(info.types).to.deep.equal([]);
            });
        });
    }
}
