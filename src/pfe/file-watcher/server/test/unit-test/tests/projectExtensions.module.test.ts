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
import * as projectExtensions from "../../../src/extensions/projectExtensions";
import * as projectsController from "../../../src/controllers/projectsController";
import * as projectUtil from "../../../src/projects/projectUtil";
import * as app_configs from "../../functional-test/configs/app.config";
import { ProjectInfo, UpdateProjectInfoPair, ProjectCapabilities } from "../../../src/projects/Project";
import { existsAsync, mkdirAsync, copyAsync, rmdirAsync, unlinkAsync } from "../../functional-test/lib/utils";

export function projectExtensionsTestModule(): void {

    const someRandomExtension: string = "someRandomExtension";
    const defaultCodewindProjectTypes: string[] = ["liberty", "spring", "swift", "nodejs", "docker"];

    it("setProjectExtensionList: " + someRandomExtension + " & isProjectExtensionSupported: " + someRandomExtension, async () => {
        projectExtensions.setProjectExtensionList(someRandomExtension);
        const isExtensionSupported = projectExtensions.isProjectExtensionSupported(someRandomExtension);
        expect(isExtensionSupported).to.equal(true);
    });

    it("removeProjectExtensionList: " + someRandomExtension + " & isProjectExtensionSupported: " + someRandomExtension, async () => {
        projectExtensions.removeProjectExtensionList(someRandomExtension);
        const isExtensionSupported = projectExtensions.isProjectExtensionSupported(someRandomExtension);
        expect(isExtensionSupported).to.equal(false);
    });

    it("getAllProjectTypes" , async () => {
        const projectTypes: string[] = projectExtensions.getAllProjectTypes();
        expect(projectTypes.toString()).to.equal(defaultCodewindProjectTypes.toString());
    });

    describe("Combinational testing of getProjectTypes function", () => {

        const libertyDummyProjectPath = path.join(app_configs.projectDataDir, "libertyDummyProject");
        const originalLibertyPOM = path.join(app_configs.projectDataDir, "dummymicroprofilepom.xml");
        const testLibertyPOM = path.join(libertyDummyProjectPath, "pom.xml");


        before("create test directories", async () => {
            if (!(await existsAsync(libertyDummyProjectPath))) {
                await mkdirAsync(libertyDummyProjectPath);
                await copyAsync(originalLibertyPOM, testLibertyPOM);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(libertyDummyProjectPath))) {
                await unlinkAsync(testLibertyPOM);
                await rmdirAsync(libertyDummyProjectPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "location": undefined,
                "result": defaultCodewindProjectTypes
            },
            "combo2": {
                "location": libertyDummyProjectPath,
                "result": ["liberty"]
            }
        };

        for (const combo of Object.keys(combinations)) {
            const location = combinations[combo]["location"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => getProjectTypes: " + location, async () => {
                const projectTypes: string[] = await projectExtensions.getProjectTypes(location);
                expect(projectTypes.toString()).to.equal(expectedResult.toString());
            });
        }
    });

    describe("Combinational testing of determineProjectType function", () => {

        const libertyDummyProjectPath = path.join(app_configs.projectDataDir, "libertyDummyProject");
        const originalLibertyPOM = path.join(app_configs.projectDataDir, "dummymicroprofilepom.xml");
        const testLibertyPOM = path.join(libertyDummyProjectPath, "pom.xml");


        before("create test directories", async () => {
            if (!(await existsAsync(libertyDummyProjectPath))) {
                await mkdirAsync(libertyDummyProjectPath);
                await copyAsync(originalLibertyPOM, testLibertyPOM);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(libertyDummyProjectPath))) {
                await unlinkAsync(testLibertyPOM);
                await rmdirAsync(libertyDummyProjectPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "location": undefined,
                "result": "FILE_NOT_EXIST"
            },
            "combo2": {
                "location": libertyDummyProjectPath,
                "result": ["liberty"]
            }
        };

        for (const combo of Object.keys(combinations)) {
            const location = combinations[combo]["location"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => determineProjectType: " + location, async () => {
                try {
                    const projectTypes: string[] = await projectExtensions.getProjectTypes(location);
                    expect(projectTypes.toString()).to.equal(expectedResult.toString());
                } catch (err) {
                    expect(err.message).to.contain(expectedResult);
                }
            });
        }
    });

    describe("Combinational testing of getProjectHandler function", () => {

        const nodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const nodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const nodeTestProjectMetadata = path.join(nodeProjectMetadataPath, "dummynodeproject.json");

        const springProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyspringproject");
        const springOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyspringproject.json");
        const springTestProjectMetadata = path.join(springProjectMetadataPath, "dummyspringproject.json");

        const swiftProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyswiftproject");
        const swiftOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyswiftproject.json");
        const swiftTestProjectMetadata = path.join(swiftProjectMetadataPath, "dummyswiftproject.json");

        const keyValuePair: UpdateProjectInfoPair = {
            key: "projectType",
            value: "",
            saveIntoJsonFile: true
        };

        before("create test directories", async () => {
            if (!(await existsAsync(nodeProjectMetadataPath))) {
                await mkdirAsync(nodeProjectMetadataPath);
                await copyAsync(nodeOriginalProjectMetadata, nodeTestProjectMetadata);
            }

            if (!(await existsAsync(springProjectMetadataPath))) {
                await mkdirAsync(springProjectMetadataPath);
                await copyAsync(springOriginalProjectMetadata, springTestProjectMetadata);
            }

            if (!(await existsAsync(swiftProjectMetadataPath))) {
                await mkdirAsync(swiftProjectMetadataPath);
                await copyAsync(swiftOriginalProjectMetadata, swiftTestProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(nodeProjectMetadataPath))) {
                await unlinkAsync(nodeTestProjectMetadata);
                await rmdirAsync(nodeProjectMetadataPath);
            }

            if ((await existsAsync(springProjectMetadataPath))) {
                await unlinkAsync(springTestProjectMetadata);
                await rmdirAsync(springProjectMetadataPath);
            }

            if ((await existsAsync(swiftProjectMetadataPath))) {
                await unlinkAsync(swiftTestProjectMetadata);
                await rmdirAsync(swiftProjectMetadataPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "projectID": "dummynodeproject",
                "resultProjectHandler": "nodejs",
                "resultProjectCapabilities": {
                    startModes: ["run", "debugNoInit"],
                    controlCommands: ["restart"]
                }
            },
            "combo2": {
                "projectID": "dummyspringproject",
                "resultProjectHandler": undefined,
                "resultProjectCapabilities": {
                    startModes: ["run"],
                    controlCommands: []
                }
            },
            "combo3": {
                "projectID": "dummyswiftproject",
                "resultProjectHandler": "swift",
                "resultProjectCapabilities": {
                    startModes: ["run"],
                    controlCommands: []
                }
            }
        };

        for (const combo of Object.keys(combinations)) {
            const projectID = combinations[combo]["projectID"];
            const expectedResultProjectHandler = combinations[combo]["resultProjectHandler"];
            const expectedResultProjectCapabilities = combinations[combo]["resultProjectCapabilities"];

            it(combo + " => getProjectHandler & getProjectCapabilities: projectID " + projectID, async () => {
                let projectInfo: ProjectInfo;
                if (combo == "combo2") {
                    projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);
                } else {
                    projectInfo = await projectUtil.getProjectInfo(projectID);
                }
                const projectHandler: any = await projectExtensions.getProjectHandler(projectInfo);
                if (projectInfo.projectType) {
                    expect(projectHandler).to.exist;
                    expect(projectHandler.supportedType).to.equal(expectedResultProjectHandler);
                } else if (!projectInfo.projectType) {
                    expect(projectHandler).to.not.exist;
                    expect(projectHandler).to.equal(expectedResultProjectHandler);
                }
                const projectCapabilities = projectExtensions.getProjectCapabilities(projectHandler);
                expect(projectCapabilities.toString()).to.equal(expectedResultProjectCapabilities.toString());
            });
        }
    });
}