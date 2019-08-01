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
import * as path from "path";
import * as fs from "fs";

import * as workspaceSettings from "../../../../server/src/utils/workspaceSettings";
import * as constants from "../../../../server/src/projects/constants";
import * as projectsController from "../../../../server/src/controllers/projectsController";


export function workspaceSettingsTestModule(): void {
    describe("combinational testing of getWorkspaceSettingsInfo function", () => {
        const workspaceSettingsDir = constants.workspaceConstants.workspaceSettingsDir;
        const workspaceSettingsFile = constants.workspaceConstants.workspaceSettingsFile;
        before("create workspace settings directory with config file", () => {
            if (!fs.existsSync(workspaceSettingsDir)) {
                fs.mkdirSync(workspaceSettingsDir);
            }
            expect(fs.statSync(workspaceSettingsDir)).to.exist;

        });

        after("remove the test directory", async () => {
            await projectsController.deleteFolder(workspaceSettingsDir);
            try {
                fs.statSync(workspaceSettingsDir);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
        });

        const combinations: any = {
            "combo1": {
                "file": path.join(workspaceSettingsDir, "testconfig.json"),
                "data": '{ "deploymentRegistry": "testRegistry" }',
                "result": {"deploymentRegistry":"", "watcherChunkTimeout":""}
            },
            "combo2": {
                "file": workspaceSettingsFile,
                "data": "non-json data",
                "result": {}
            },
            "combo3": {
                "file": workspaceSettingsFile,
                "data": '{ "test": "data" }',
                "result": {"test":"data"}
            },
            "combo4": {
                "file": workspaceSettingsFile,
                "data": '{ "deploymentRegistry": "testRegistry" }',
                "result": {"deploymentRegistry": "testRegistry"}
            },
            "combo5": {
                "file": workspaceSettingsFile,
                "data": '{ "deploymentRegistry": "testRegistry", "watcherChunkTimeout":5000 }',
                "result": {"deploymentRegistry": "testRegistry", "watcherChunkTimeout": 5000}
            }
        };
        for (const combo of Object.keys(combinations)) {

            const file = combinations[combo]["file"];
            const data = combinations[combo]["data"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => file: " + file + ", data: " + data, async() => {
                fs.writeFileSync(file, data);
                expect(fs.statSync(file)).to.exist;
                const actualResult = await workspaceSettings.getWorkspaceSettingsInfo();
                if (actualResult.statusCode === 500) {
                    expect(actualResult.msg).to.contains(expectedResult);
                } else {
                    expect(actualResult).to.deep.equal(expectedResult);
                }
            });
        }
    });

    describe("combinational testing of readWorkspaceSettings function", () => {
        const workspaceSettingsDir = constants.workspaceConstants.workspaceSettingsDir;
        const workspaceSettingsFile = constants.workspaceConstants.workspaceSettingsFile;
        before("create workspace settings directory with config file", () => {
            if (!fs.existsSync(workspaceSettingsDir)) {
                fs.mkdirSync(workspaceSettingsDir);
            }
            expect(fs.statSync(workspaceSettingsDir)).to.exist;

        });

        after("remove the test directory", async () => {
            await projectsController.deleteFolder(workspaceSettingsDir);
            try {
                fs.statSync(workspaceSettingsDir);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
        });

        const combinations: any = {
            "combo1": {
                "file": path.join(workspaceSettingsDir, "testconfig.json"),
                "data": '{ "deploymentRegistry": "testRegistry" }',
                "result": "The workspace settings file was not found at location"
            },
            "combo2": {
                "file": workspaceSettingsFile,
                "data": "non-json data",
                "result": {"statusCode": 200, "workspaceSettings": {"deploymentRegistry":"", "watcherChunkTimeout":""}}
            },
            "combo3": {
                "file": workspaceSettingsFile,
                "data": '{ "test": "data" }',
                "result": {"statusCode": 200, "workspaceSettings": {"deploymentRegistry":"", "watcherChunkTimeout":""}}
            },
            "combo4": {
                "file": workspaceSettingsFile,
                "data": '{ "deploymentRegistry": "testRegistry" }',
                "result": {"statusCode": 200, "workspaceSettings": {"deploymentRegistry": "testRegistry", "watcherChunkTimeout":""}}
            },
            "combo5": {
                "file": workspaceSettingsFile,
                "data": '{ "deploymentRegistry": "testRegistry", "watcherChunkTimeout":5000 }',
                "result": {"statusCode": 200, "workspaceSettings": {"deploymentRegistry": "testRegistry", "watcherChunkTimeout": 5000}}
            },
            "combo6": {
                "file": workspaceSettingsFile,
                "data": '{ "deploymentRegistry": "|}{"}',
                "result": "Codewind detected an error with the Deployment Registry"
            }
        };
        for (const combo of Object.keys(combinations)) {

            const file = combinations[combo]["file"];
            const data = combinations[combo]["data"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => file: " + file + ", data: " + data, async() => {
                fs.writeFileSync(file, data);
                expect(fs.statSync(file)).to.exist;
                const actualResult = await workspaceSettings.readWorkspaceSettings();
                if (actualResult.statusCode === 500) {
                    expect(actualResult.msg).to.contains(expectedResult);
                } else {
                    expect(actualResult).to.deep.equal(expectedResult);
                }
            });
        }
    });

    describe("combinational testing of deploymentRegistryStatus function", () => {

        const combinations: any = {
            "combo1": {
                "data": {"projectID": "testProjectID", "detailedDeploymentRegistryStatus": "test.NLSMessage"},
                "result": 200
            },
            "combo2": {
                "data": {"projectID": "testProjectID"},
                "result": 400
            },
            "combo3": {
                "data": {"detailedDeploymentRegistryStatus": "test.NLSMessage"},
                "result": 400
            }
        };
        for (const combo of Object.keys(combinations)) {

            const data = combinations[combo]["data"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => data: " + data, async() => {
                const actualResult = await workspaceSettings.deploymentRegistryStatus(data);
                expect(actualResult.statusCode).to.equal(expectedResult);
            });
        }
    });
}
