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
import { workspaceConstants } from "../../../src/projects/constants";
import { existsAsync, mkdirAsync, copyAsync, rmdirAsync, unlinkAsync, writeAsync } from "../../functional-test/lib/utils";
import * as timeout_configs from "../../functional-test/configs/timeout.config";

export function projectExtensionsTestModule(): void {

    const someRandomExtension: string = "someRandomExtension";
    const defaultCodewindProjectTypes: string[] = ["liberty", "spring", "swift", "nodejs", "docker"];

    const libertyDummyProjectPath = path.join(app_configs.projectDataDir, "libertyDummyProject");
    const originalLibertyPOM = path.join(app_configs.projectDataDir, "javaMicroProfileTemplate" , "pom.xml");
    const testLibertyPOM = path.join(libertyDummyProjectPath, "pom.xml");

    const springDummyProjectPath = path.join(app_configs.projectDataDir, "springDummyProject");
    const originalSpringPOM = path.join(app_configs.projectDataDir, "springJavaTemplate", "pom.xml");
    const testSpringPOM = path.join(springDummyProjectPath, "pom.xml");

    const nodeDummyProjectPath = path.join(app_configs.projectDataDir, "nodeDummyProject");
    const testNodePackageJSON = path.join(nodeDummyProjectPath, "package.json");

    const swiftDummyProjectPath = path.join(app_configs.projectDataDir, "swiftDummyProject");
    const testSwiftPackage = path.join(swiftDummyProjectPath, "Package.swift");

    const dockerDummyProjectPath = path.join(app_configs.projectDataDir, "dockerDummyProject");
    const testdockerProjectDockerfile = path.join(dockerDummyProjectPath, "Dockerfile");

    const appsodyNodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyappsodyproject");
    const appsodyNodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyappsodyproject.json");
    const appsodyNodeTestProjectMetadata = path.join(appsodyNodeProjectMetadataPath, "dummyappsodyproject.json");

    const extensionsPath = workspaceConstants.workspaceExtensionDir;
    const appsodyExtensionPath = path.join(extensionsPath, "appsodyExtension");

    const appsodyExtensionTestArtifactPath1 = path.join(appsodyExtensionPath, ".sh-extension");
    const appsodyExtensionTestArtifactPath2 = path.join(appsodyExtensionPath, "entrypoint.sh");

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

        before("create test directories", async () => {
            if (!(await existsAsync(libertyDummyProjectPath))) {
                await mkdirAsync(libertyDummyProjectPath);
                await copyAsync(originalLibertyPOM, testLibertyPOM);
            }

            if (!(await existsAsync(springDummyProjectPath))) {
                await mkdirAsync(springDummyProjectPath);
                await copyAsync(originalSpringPOM, testSpringPOM);
            }

            if (!(await existsAsync(nodeDummyProjectPath))) {
                await mkdirAsync(nodeDummyProjectPath);
                await copyAsync(originalSpringPOM, testNodePackageJSON);
            }

            if (!(await existsAsync(swiftDummyProjectPath))) {
                await mkdirAsync(swiftDummyProjectPath);
                await copyAsync(originalSpringPOM, testSwiftPackage);
            }

            if (!(await existsAsync(dockerDummyProjectPath))) {
                await mkdirAsync(dockerDummyProjectPath);
                await copyAsync(originalSpringPOM, testdockerProjectDockerfile);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(libertyDummyProjectPath))) {
                await unlinkAsync(testLibertyPOM);
                await rmdirAsync(libertyDummyProjectPath);
            }

            if ((await existsAsync(springDummyProjectPath))) {
                await unlinkAsync(testSpringPOM);
                await rmdirAsync(springDummyProjectPath);
            }

            if ((await existsAsync(nodeDummyProjectPath))) {
                await unlinkAsync(testNodePackageJSON);
                await rmdirAsync(nodeDummyProjectPath);
            }

            if ((await existsAsync(swiftDummyProjectPath))) {
                await unlinkAsync(testSwiftPackage);
                await rmdirAsync(swiftDummyProjectPath);
            }

            if ((await existsAsync(dockerDummyProjectPath))) {
                await unlinkAsync(testdockerProjectDockerfile);
                await rmdirAsync(dockerDummyProjectPath);
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
            },
            "combo3": {
                "location": springDummyProjectPath,
                "result": ["spring"]
            },
            "combo4": {
                "location": nodeDummyProjectPath,
                "result": ["nodejs"]
            },
            "combo5": {
                "location": swiftDummyProjectPath,
                "result": ["swift"]
            },
            "combo6": {
                "location": dockerDummyProjectPath,
                "result": ["docker"]
            }
        };

        for (const combo of Object.keys(combinations)) {
            const location = combinations[combo]["location"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => determineProjectType: " + location, async () => {
                try {
                    const projectTypes: string[] = await projectExtensions.determineProjectType(location);
                    expect(projectTypes.toString()).to.equal(expectedResult.toString());
                } catch (err) {
                    expect(err.name).to.equal(expectedResult);
                }
            });
        }
    });

    describe.only("Combinational testing of getProjectHandler function", () => {

        const nodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const nodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const nodeTestProjectMetadata = path.join(nodeProjectMetadataPath, "dummynodeproject.json");

        const springProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyspringproject");
        const springOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyspringproject.json");
        const springTestProjectMetadata = path.join(springProjectMetadataPath, "dummyspringproject.json");

        const swiftProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyswiftproject");
        const swiftOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyswiftproject.json");
        const swiftTestProjectMetadata = path.join(swiftProjectMetadataPath, "dummyswiftproject.json");

        const microprofileProjectMetadataPath = path.join(app_configs.projectDataDir, "dummymicroprofileproject");
        const microprofileOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummymicroprofileproject.json");
        const microprofileTestProjectMetadata = path.join(microprofileProjectMetadataPath, "dummymicroprofileproject.json");

        const keyValuePair: UpdateProjectInfoPair = {
            key: "projectType",
            value: "",
            saveIntoJsonFile: true
        };

        before("create test directories", async () => {
            // if (!(await existsAsync(nodeProjectMetadataPath))) {
            //     await mkdirAsync(nodeProjectMetadataPath);
            //     await copyAsync(nodeOriginalProjectMetadata, nodeTestProjectMetadata);
            // }

            // if (!(await existsAsync(springProjectMetadataPath))) {
            //     await mkdirAsync(springProjectMetadataPath);
            //     await copyAsync(springOriginalProjectMetadata, springTestProjectMetadata);
            // }

            // if (!(await existsAsync(swiftProjectMetadataPath))) {
            //     await mkdirAsync(swiftProjectMetadataPath);
            //     await copyAsync(swiftOriginalProjectMetadata, swiftTestProjectMetadata);
            // }

            // if (!(await existsAsync(microprofileProjectMetadataPath))) {
            //     await mkdirAsync(microprofileProjectMetadataPath);
            //     await copyAsync(microprofileOriginalProjectMetadata, microprofileTestProjectMetadata);
            // }
            process.env.HIDE_PFE_LOG = "n";

            if (!(await existsAsync(appsodyNodeProjectMetadataPath))) {
                await mkdirAsync(appsodyNodeProjectMetadataPath);
                await copyAsync(appsodyNodeOriginalProjectMetadata, appsodyNodeTestProjectMetadata);
            }

            if (!(await existsAsync(extensionsPath))) {
                await mkdirAsync(extensionsPath);
            }
            expect(fs.statSync(extensionsPath)).to.exist;

            if (!await existsAsync(appsodyExtensionPath)) {
                await mkdirAsync(appsodyExtensionPath);
            }
            expect(fs.statSync(appsodyExtensionPath)).to.exist;

            await writeAsync(appsodyExtensionTestArtifactPath1, '{"container": {"prefix": "testprefix-", "suffix": "-testsuffix"}}');
            await writeAsync(appsodyExtensionTestArtifactPath2, "echo $(pwd)");
            expect(fs.statSync(appsodyExtensionTestArtifactPath1)).to.exist;
            expect(fs.statSync(appsodyExtensionTestArtifactPath2)).to.exist;
        });

        after("remove test directories", async () => {
            // if ((await existsAsync(nodeProjectMetadataPath))) {
            //     await unlinkAsync(nodeTestProjectMetadata);
            //     await rmdirAsync(nodeProjectMetadataPath);
            // }

            // if ((await existsAsync(springProjectMetadataPath))) {
            //     await unlinkAsync(springTestProjectMetadata);
            //     await rmdirAsync(springProjectMetadataPath);
            // }

            // if ((await existsAsync(swiftProjectMetadataPath))) {
            //     await unlinkAsync(swiftTestProjectMetadata);
            //     await rmdirAsync(swiftProjectMetadataPath);
            // }

            // if ((await existsAsync(microprofileProjectMetadataPath))) {
            //     await unlinkAsync(microprofileTestProjectMetadata);
            //     await rmdirAsync(microprofileProjectMetadataPath);
            // }

            process.env.HIDE_PFE_LOG = "y";

            if ((await existsAsync(appsodyNodeProjectMetadataPath))) {
                await unlinkAsync(appsodyNodeTestProjectMetadata);
                await rmdirAsync(appsodyNodeProjectMetadataPath);
            }

            if ((await existsAsync(extensionsPath))) {
                if (await existsAsync(appsodyExtensionPath)) {
                    await unlinkAsync(appsodyExtensionTestArtifactPath1);
                    await unlinkAsync(appsodyExtensionTestArtifactPath2);
                    await rmdirAsync(appsodyExtensionPath);
                }
                await rmdirAsync(extensionsPath);
            }
        });

        const combinations: any = {
            // "combo1": {
            //     "projectID": "dummynodeproject",
            //     "resultProjectHandler": "nodejs",
            //     "resultProjectCapabilities": {
            //         startModes: ["run", "debugNoInit"],
            //         controlCommands: ["restart"]
            //     }
            // },
            // "combo2": {
            //     "projectID": "dummyspringproject",
            //     "resultProjectHandler": "spring",
            //     "resultProjectCapabilities": {
            //         startModes: ["run", "debug", "debugNoInit"],
            //         controlCommands: ["restart"]
            //     }
            // },
            // "combo3": {
            //     "projectID": "dummyspringproject",
            //     "resultProjectHandler": undefined,
            //     "resultProjectCapabilities": {
            //         startModes: ["run"],
            //         controlCommands: []
            //     }
            // },
            // "combo4": {
            //     "projectID": "dummyswiftproject",
            //     "resultProjectHandler": "swift",
            //     "resultProjectCapabilities": {
            //         startModes: ["run"],
            //         controlCommands: []
            //     }
            // },
            // "combo5": {
            //     "projectID": "dummymicroprofileproject",
            //     "resultProjectHandler": "liberty",
            //     "resultProjectCapabilities": {
            //         startModes: ["run", "debug"],
            //         controlCommands: ["restart"]
            //     }
            // },
            "combo6": {
                "projectID": "dummyappsodyproject",
                "resultProjectHandler": "appsodyExtension",
                "resultProjectCapabilities": {
                    startModes: ["run"],
                    controlCommands: ["restart"]
                }
            }
        };

        for (const combo of Object.keys(combinations)) {
            const projectID = combinations[combo]["projectID"];
            const expectedResultProjectHandler = combinations[combo]["resultProjectHandler"];
            const expectedResultProjectCapabilities = combinations[combo]["resultProjectCapabilities"];

            it(combo + " => getProjectHandler & getProjectCapabilities: projectID " + projectID, async () => {
                let projectInfo: ProjectInfo;
                if (combo == "combo3") {
                    projectInfo = await projectsController.updateProjectInfo(projectID, keyValuePair);
                } else {
                    projectInfo = await projectUtil.getProjectInfo(projectID);
                }
                if (projectInfo.extensionID) {
                    projectInfo.extensionID = appsodyExtensionPath;
                }
                console.log(">> Project info: %j", projectInfo);
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
            }).timeout(timeout_configs.defaultTimeout);
        }
    });

    describe.only("testing of removeProjectHandler function", () => {

        const projectID: string = "dummyappsodyproject";


        before("create test directories", async () => {
            process.env.HIDE_PFE_LOG = "n";

            if (!(await existsAsync(appsodyNodeProjectMetadataPath))) {
                await mkdirAsync(appsodyNodeProjectMetadataPath);
                await copyAsync(appsodyNodeOriginalProjectMetadata, appsodyNodeTestProjectMetadata);
            }

            if (!(await existsAsync(extensionsPath))) {
                await mkdirAsync(extensionsPath);
                if (!await existsAsync(appsodyExtensionPath)) {
                    await mkdirAsync(appsodyExtensionPath);
                    await writeAsync(appsodyExtensionTestArtifactPath1, '{"container": {"prefix": "testprefix-", "suffix": "-testsuffix"}}');
                    await writeAsync(appsodyExtensionTestArtifactPath2, "echo $(pwd)");
                }
            }
        });

        after("remove test directories", async () => {
            process.env.HIDE_PFE_LOG = "y";

            if ((await existsAsync(appsodyNodeProjectMetadataPath))) {
                await unlinkAsync(appsodyNodeTestProjectMetadata);
                await rmdirAsync(appsodyNodeProjectMetadataPath);
            }

            if ((await existsAsync(extensionsPath))) {
                if (await existsAsync(appsodyExtensionPath)) {
                    await unlinkAsync(appsodyExtensionTestArtifactPath1);
                    await unlinkAsync(appsodyExtensionTestArtifactPath2);
                    await rmdirAsync(appsodyExtensionPath);
                }
                await rmdirAsync(extensionsPath);
            }
        });

        it("removeProjectHandler: " + projectID, async () => {
            const projectInfo: ProjectInfo = await projectUtil.getProjectInfo(projectID);
            const projectHandler: any = await projectExtensions.removeProjectHandler(projectInfo);
            expect(projectHandler).to.exist;
            expect(projectHandler.supportedType).to.equal("appsodyExtension");
        });
    });
}