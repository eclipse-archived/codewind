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
import { promisify } from "util";
import * as projectsController from "../../../src/controllers/projectsController";
import * as app_configs from "../../functional-test/configs/app.config";
import { ProjectMetadata, UpdateProjectInfoPair, ProjectInfo } from "../../../src/projects/Project";
import * as constants from "../../../src/projects/constants";
import { update } from "../../../src/projects/libertyProject";

const existsAsync = promisify(fs.exists);
const mkdirAsync = promisify(fs.mkdir);
const copyAsync = promisify(fs.copyFile);
const rmdirAsync = promisify(fs.rmdir);
const unlinkAsync = promisify(fs.unlink);

export function projectsControllerTestModule(): void {

    describe("Projects Controller Unit Test", () => {

        describe("Combinational testing of getProjectMetadataById function", () => {

            const projectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
            const originalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
            const testProjectMetadata = path.join(projectMetadataPath, "dummynodeproject.json");

            before("create test directories", async () => {
                if (!(await existsAsync(projectMetadataPath))) {
                    await mkdirAsync(projectMetadataPath);
                    await copyAsync(originalProjectMetadata, testProjectMetadata);
                }
            });

            after("remove test directories", async () => {
                if ((await existsAsync(projectMetadataPath))) {
                    await unlinkAsync(testProjectMetadata);
                    await rmdirAsync(projectMetadataPath);
                }
            });

            it("combo1 => getProjectMetadataById: dummynodeproject", async () => {
                const dummyProjectMetadata: ProjectMetadata = projectsController.getProjectMetadataById("dummynodeproject");
                expect(dummyProjectMetadata.dir).to.exist;
                expect(dummyProjectMetadata.dir).to.equal(constants.projectConstants.projectsDataDir + "dummynodeproject/");
                expect(dummyProjectMetadata.infoFile).to.exist;
                expect(dummyProjectMetadata.infoFile).to.equal(constants.projectConstants.projectsDataDir + "dummynodeproject/dummynodeproject.json");
                expect(dummyProjectMetadata.logDir).to.exist;
                expect(dummyProjectMetadata.logDir).to.equal(constants.projectConstants.projectsLogDir);
            });
        });

        describe("Combinational testing of getProjectInfoFromFile function", () => {

            const goodProjectID = "dummynodeproject";
            const badProjectID = "badProjectID";
            const dummyProjectMetadata: ProjectMetadata = projectsController.getProjectMetadataById(goodProjectID);
            const dummyProjectMetadataBad: ProjectMetadata = projectsController.getProjectMetadataById(badProjectID);

            const projectMetadataPath = path.join(app_configs.projectDataDir, goodProjectID);
            const originalProjectMetadata = path.join(app_configs.projectDataDir, goodProjectID + ".json");
            const testProjectMetadata = path.join(projectMetadataPath, goodProjectID + ".json");

            before("create test directories", async () => {
                if (!(await existsAsync(projectMetadataPath))) {
                    await mkdirAsync(projectMetadataPath);
                    await copyAsync(originalProjectMetadata, testProjectMetadata);
                }
            });

            after("remove test directories", async () => {
                if ((await existsAsync(projectMetadataPath))) {
                    await unlinkAsync(testProjectMetadata);
                    await rmdirAsync(projectMetadataPath);
                }
            });

            const combinations: any = {
                "combo1": {
                    "projectID": goodProjectID,
                    "inputFile": dummyProjectMetadata.infoFile,
                    "result": {
                        projectID: "dummynodeproject"
                    }
                },
                "combo2": {
                    "projectID": badProjectID,
                    "inputFile": dummyProjectMetadataBad.infoFile,
                    "result": undefined
                },
                "combo3": {
                    "projectID": undefined,
                    "inputFile": undefined,
                    "result": undefined
                }
            };

            for (const combo of Object.keys(combinations)) {
                const projectID = combinations[combo]["projectID"];
                const inputFile = combinations[combo]["inputFile"];
                const expectedResult = combinations[combo]["result"];

                it(combo + " => getProjectInfoFromFile: " + inputFile, async () => {
                    const projectInfo: any = await projectsController.getProjectInfoFromFile(inputFile);
                    if (projectID == goodProjectID) {
                        expect(projectInfo).to.exist;
                        expect(projectInfo.projectID).to.exist;
                        expect(projectInfo.projectID).to.equal(expectedResult.projectID);
                        expect(projectInfo.projectType).to.exist;
                        expect(projectInfo.location).to.exist;
                        expect(projectInfo.autoBuildEnabled).to.exist;
                        expect(projectInfo.startMode).to.exist;
                    } else {
                        expect(projectInfo).to.not.exist;
                        expect(projectInfo).to.equal(expectedResult);
                    }
                });
            }
        });

        describe("Combinational testing of updateProjectInfo function", () => {

            const goodProjectID = "dummynodeproject";
            const badProjectID = "badProjectID";
            const dummyProjectMetadata: ProjectMetadata = projectsController.getProjectMetadataById(goodProjectID);
            const dummyProjectMetadataBad: ProjectMetadata = projectsController.getProjectMetadataById(badProjectID);

            const projectMetadataPath = path.join(app_configs.projectDataDir, goodProjectID);
            const originalProjectMetadata = path.join(app_configs.projectDataDir, goodProjectID + ".json");
            const testProjectMetadata = path.join(projectMetadataPath, goodProjectID + ".json");

            const keyValuePair1: UpdateProjectInfoPair = {
                key: "debugPort",
                value: "9999",
                saveIntoJsonFile: true
            };

            const keyValuePair2: UpdateProjectInfoPair = {
                key: "garbageKey",
                value: "garbage",
                saveIntoJsonFile: true
            };

            const keyValuePair3: UpdateProjectInfoPair = {
                key: "garbageKey",
                value: "someMoreGarbage",
                saveIntoJsonFile: false
            };

            before("create test directories", async () => {
                if (!(await existsAsync(projectMetadataPath))) {
                    await mkdirAsync(projectMetadataPath);
                    await copyAsync(originalProjectMetadata, testProjectMetadata);
                }
            });

            after("remove test directories", async () => {
                if ((await existsAsync(projectMetadataPath))) {
                    await unlinkAsync(testProjectMetadata);
                    await rmdirAsync(projectMetadataPath);
                }
            });

            const combinations: any = {
                "combo1": {
                    "projectID": goodProjectID,
                    "updateProjectInfoPair": keyValuePair1,
                    "inputFile": dummyProjectMetadata.infoFile,
                    "result": {
                        debugPort: "9999"
                    }
                },
                "combo2": {
                    "projectID": goodProjectID,
                    "updateProjectInfoPair": keyValuePair2,
                    "inputFile": dummyProjectMetadata.infoFile,
                    "result": {
                        garbageKey: "garbage"
                    }
                },
                "combo3": {
                    "projectID": goodProjectID,
                    "updateProjectInfoPair": keyValuePair3,
                    "inputFile": dummyProjectMetadata.infoFile,
                    "result": {
                        garbageKey: "someMoreGarbage"
                    }
                },
                "combo4": {
                    "projectID": badProjectID,
                    "updateProjectInfoPair": keyValuePair1,
                    "inputFile": dummyProjectMetadataBad.infoFile,
                    "result": "Failed"
                }
            };

            for (const combo of Object.keys(combinations)) {
                const projectID = combinations[combo]["projectID"];
                const updateProjectInfoPair = combinations[combo]["updateProjectInfoPair"];
                const inputFile = combinations[combo]["inputFile"];
                const expectedResult = combinations[combo]["result"];

                it(combo + " => updateProjectInfo: " + projectID + " " +  JSON.stringify(updateProjectInfoPair), async () => {
                    try {
                        const projectInfoUpdated: ProjectInfo = await projectsController.updateProjectInfo(projectID, updateProjectInfoPair);
                        const projectInfoAfter: any = await projectsController.getProjectInfoFromFile(inputFile);
                        if (expectedResult.debugPort) {
                            expect(projectInfoUpdated).to.exist;
                            expect(projectInfoUpdated.debugPort).equal(expectedResult.debugPort);
                            expect(projectInfoAfter.debugPort).to.equal(expectedResult.debugPort);
                        } else if (expectedResult.garbageKey) {
                            expect(projectInfoUpdated).to.exist;
                            expect(projectInfoUpdated.garbageKey).equal(expectedResult.garbageKey);
                            expect(projectInfoAfter.garbageKey).to.exist;
                            if (expectedResult.garbageKey == "garbage") {
                                expect(projectInfoAfter.garbageKey).to.equal(expectedResult.garbageKey);
                            } else if (expectedResult.garbageKey == "garbage") {
                                expect(projectInfoAfter.garbageKey).to.not.equal(expectedResult.garbageKey);
                            }
                        }
                    } catch (err) {
                        expect(err.toString()).to.contain(expectedResult);
                    }
                });
            }
        });

        describe("Combinational testing of saveProjectInfo function", () => {

            const goodProjectID = "dummynodeproject";
            const badProjectID = "badProjectID";
            const dummyProjectMetadata: ProjectMetadata = projectsController.getProjectMetadataById(goodProjectID);
            const dummyProjectMetadataBad: ProjectMetadata = projectsController.getProjectMetadataById(badProjectID);

            const projectMetadataPath = path.join(app_configs.projectDataDir, goodProjectID);
            const originalProjectMetadata = path.join(app_configs.projectDataDir, goodProjectID + ".json");
            const testProjectMetadata = path.join(projectMetadataPath, goodProjectID + ".json");

            const keyValuePair1: UpdateProjectInfoPair = {
                key: "debugPort",
                value: "9999",
                saveIntoJsonFile: true
            };

            const keyValuePair2: UpdateProjectInfoPair = {
                key: "debugPort",
                value: "1111",
                saveIntoJsonFile: false
            };

            before("create test directories", async () => {
                if (!(await existsAsync(projectMetadataPath))) {
                    await mkdirAsync(projectMetadataPath);
                    await copyAsync(originalProjectMetadata, testProjectMetadata);
                }
            });

            after("remove test directories", async () => {
                if ((await existsAsync(projectMetadataPath))) {
                    await unlinkAsync(testProjectMetadata);
                    await rmdirAsync(projectMetadataPath);
                }
            });

            const combinations: any = {
                "combo1": {
                    "projectID": goodProjectID,
                    "updateProjectInfoPair": keyValuePair1,
                    "inputFile": dummyProjectMetadata.infoFile,
                    "result": {
                        debugPort: "9999"
                    }
                },
                "combo2": {
                    "projectID": badProjectID,
                    "updateProjectInfoPair": keyValuePair1,
                    "inputFile": dummyProjectMetadata.infoFile,
                    "result": "ENOENT"
                },
                "combo3": {
                    "projectID": goodProjectID,
                    "updateProjectInfoPair": keyValuePair2,
                    "inputFile": dummyProjectMetadata.infoFile,
                    "result": {
                        debugPort: "1111"
                    }
                }
            };

            for (const combo of Object.keys(combinations)) {
                const projectID = combinations[combo]["projectID"];
                const updateProjectInfoPair = combinations[combo]["updateProjectInfoPair"];
                const inputFile = combinations[combo]["inputFile"];
                const expectedResult = combinations[combo]["result"];

                it(combo + " => saveProjectInfo: " + projectID, async () => {
                    try {
                        const projectInfoUpdated: ProjectInfo = await projectsController.updateProjectInfo(goodProjectID, updateProjectInfoPair);
                        await projectsController.saveProjectInfo(projectID, projectInfoUpdated, updateProjectInfoPair.saveIntoJsonFile);
                        const projectInfoAfter: any = await projectsController.getProjectInfoFromFile(inputFile);
                        expect(projectInfoAfter).to.exist;
                        expect(projectInfoAfter.debugPort).to.equal(expectedResult.debugPort);
                    } catch (err) {
                        expect(err.code).to.equal(expectedResult);
                    }
                });
            }
        });

        describe("Combinational testing of deleteFile function", () => {

            const originalFile = path.join(app_configs.projectDataDir, "dummynodeproject.json");
            const testFirstLevelDir = path.join(app_configs.projectDataDir, "testFirstLevelDir");
            const testFirstLevelFile = path.join(testFirstLevelDir, "testFirstLevelFile.json");
            const testSecondLevelDir = path.join(testFirstLevelDir, "testSecondLevelDir");
            const testSecondLevelFile = path.join(testSecondLevelDir, "testSecondLevelFile.json");

            before("create test directories", async () => {
                if (!(await existsAsync(testFirstLevelDir))) {
                    await mkdirAsync(testFirstLevelDir);
                    await copyAsync(originalFile, testFirstLevelFile);

                    if (!(await existsAsync(testSecondLevelDir))) {
                        await mkdirAsync(testSecondLevelDir);
                        await copyAsync(originalFile, testSecondLevelFile);
                    }
                }
            });

            after("remove test directories", async () => {
                if ((await existsAsync(testSecondLevelDir))) {
                    await unlinkAsync(testSecondLevelFile);
                    await rmdirAsync(testSecondLevelDir);
                }

                if ((await existsAsync(testFirstLevelDir))) {
                    await unlinkAsync(testFirstLevelFile);
                    await rmdirAsync(testFirstLevelDir);
                }
            });

            const combinations: any = {
                "combo1": {
                    "projectID": "",
                    "result": ""
                }
            };

            for (const combo of Object.keys(combinations)) {
                const projectID = combinations[combo]["projectID"];
                const expectedResult = combinations[combo]["result"];

                it(combo + " => saveProjectInfo: " + projectID, async () => {
                    console.log("hi");
                });
            }
        });
    });
}