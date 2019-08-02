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

import * as libertyProject from "../../../src/projects/libertyProject";
import * as socket from "../../../src/utils/socket";
import * as app_configs from "../../functional-test/configs/app.config";
import { existsAsync, mkdirAsync, copyAsync, rmdirAsync, unlinkAsync, openAsync, readAsync } from "../../functional-test/lib/utils";
import { Operation } from "../../../src/projects/operation";
import { ProjectInfo, UpdateProjectInfoPair } from "../../../src/projects/Project";
import * as projectUtil from "../../../src/projects/projectUtil";
import * as projectsController from "../../../src/controllers/projectsController";
import * as locale from "../../../src/utils/locale";
import * as constants from "../../../src/projects/constants";

export function libertyProjectTestModule(): void {

    const libertyDummyProjectPath = path.join(app_configs.projectDataDir, "libertyDummyProject");
    const originalLibertyPOM = path.join(app_configs.projectDataDir, "dummymicroprofilepom.xml");
    const testLibertyPOM = path.join(libertyDummyProjectPath, "pom.xml");
    const originalLibertyDockerfile = path.join(app_configs.projectDataDir, "dummymicroprofiledockerfile");
    const testLibertyDockerfile = path.join(libertyDummyProjectPath, "Dockerfile");
    const originalLibertyDockerfileBuild = path.join(app_configs.projectDataDir, "dummymicroprofiledockerfilebuild");
    const testLibertyDockerfileBuild = path.join(libertyDummyProjectPath, "Dockerfile-build");
    const originalLibertyServerXML = path.join(app_configs.projectDataDir, "dummymicroprofileserver.xml");
    const testLibertyServerXMLPath = path.join(libertyDummyProjectPath, "/src/main/liberty/config/");
    const testLibertyServerXML = path.join(testLibertyServerXMLPath, "server.xml");

    const testLibertyDockerfileGarbage = path.join(libertyDummyProjectPath, "DockerfileGarbage");
    const testLibertyServerXMLGarbage = path.join(testLibertyServerXMLPath, "serverGarbage.xml");

    const originalLibertyPOMGarbage1 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage1.xml");
    const originalLibertyPOMGarbage2 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage2.xml");
    const originalLibertyPOMGarbage3 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage3.xml");
    const originalLibertyPOMGarbage4 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage4.xml");

    const microprofileProjectMetadataPath = path.join(app_configs.projectDataDir, "dummymicroprofileproject");
    const microprofileOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummymicroprofileproject.json");
    const microprofileTestProjectMetadata = path.join(microprofileProjectMetadataPath, "dummymicroprofileproject.json");

    const springDummyProjectPath = path.join(app_configs.projectDataDir, "springDummyProject");
    const originalSpringPOM = path.join(app_configs.projectDataDir, "dummyspringpom.xml");
    const testSpringPOM = path.join(springDummyProjectPath, "pom.xml");

    const keyValuePair: UpdateProjectInfoPair = {
        key: "location",
        value: libertyDummyProjectPath,
        saveIntoJsonFile: true
    };

    let socketData: any;

    socket.registerListener({
        name: "codewindunittest",
        handleEvent: (event, data) => {
            if (event === "projectValidated") {
                // console.log("socket event: " + event);
                // console.log("socket data: " + JSON.stringify(data));
                socketData = data;
            }
        }
    });

    describe("testing of typeMatches function", () => {

        before("create test directories", async () => {
            if (!(await existsAsync(libertyDummyProjectPath))) {
                await mkdirAsync(libertyDummyProjectPath);
                await copyAsync(originalLibertyPOM, testLibertyPOM);
            }

            if (!(await existsAsync(springDummyProjectPath))) {
                await mkdirAsync(springDummyProjectPath);
                await copyAsync(originalSpringPOM, testSpringPOM);
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
        });

        const combinations: any = {
            "combo1": {
                "location": libertyDummyProjectPath,
                "result": true
            },
            "combo2": {
                "location": springDummyProjectPath,
                "result": false
            }
        };

        for (const combo of Object.keys(combinations)) {
            const location = combinations[combo]["location"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => typeMatches: " + location, async () => {
                const isLibertyProject: boolean = await libertyProject.typeMatches(location);
                expect(isLibertyProject).to.equal(expectedResult);
            });
        }
    });

    describe("testing of validate function", () => {

        before("create test directories", async () => {
            if (!await existsAsync(libertyDummyProjectPath)) {
                await mkdirAsync(libertyDummyProjectPath);
                await copyAsync(originalLibertyPOM, testLibertyPOM);
                await copyAsync(originalLibertyDockerfile, testLibertyDockerfile);
                await copyAsync(originalLibertyDockerfileBuild, testLibertyDockerfileBuild);
                if (!await existsAsync(testLibertyServerXMLPath)) {
                    await mkdirAsync(path.join(libertyDummyProjectPath, "/src/"));
                    await mkdirAsync(path.join(libertyDummyProjectPath, "/src/main/"));
                    await mkdirAsync(path.join(libertyDummyProjectPath, "/src/main/liberty/"));
                    await mkdirAsync(path.join(libertyDummyProjectPath, "/src/main/liberty/config/"));
                }
                await copyAsync(originalLibertyServerXML, testLibertyServerXML);
            }

            if (!(await existsAsync(microprofileProjectMetadataPath))) {
                await mkdirAsync(microprofileProjectMetadataPath);
                await copyAsync(microprofileOriginalProjectMetadata, microprofileTestProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if (await existsAsync(libertyDummyProjectPath)) {
                await unlinkAsync(testLibertyPOM);
                await unlinkAsync(testLibertyDockerfile);
                await unlinkAsync(testLibertyDockerfileBuild);
                if (await existsAsync(testLibertyServerXMLPath)) {
                    await unlinkAsync(testLibertyServerXML);
                    await rmdirAsync(path.join(libertyDummyProjectPath, "/src/main/liberty/config/"));
                    await rmdirAsync(path.join(libertyDummyProjectPath, "/src/main/liberty/"));
                    await rmdirAsync(path.join(libertyDummyProjectPath, "/src/main/"));
                    await rmdirAsync(path.join(libertyDummyProjectPath, "/src/"));
                }
                await rmdirAsync(libertyDummyProjectPath);
            }

            if ((await existsAsync(microprofileProjectMetadataPath))) {
                await unlinkAsync(microprofileTestProjectMetadata);
                await rmdirAsync(microprofileProjectMetadataPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "description": "good microprofile project",
                "result": "success",
                "error": undefined,
                "buildLog": undefined
            },
            "combo2": {
                "description": "microprofile project with missing Dockerfile",
                "result": "failed",
                "error": "Missing required file",
                "buildLog": undefined
            },
            "combo3": {
                "description": "microprofile project with missing server.xml",
                "result": "failed",
                "error": "Missing required file",
                "buildLog": "Liberty server configuration file was not found"
            },
            "combo4": {
                "description": "microprofile project with bad inner most pom.xml elements",
                "result": "failed",
                "error": ["Missing Liberty parent POM groupId", "Missing Liberty parent POM artifactId", "Missing profile activation", "liberty-maven-plugin extensions not enabled", "liberty-maven-plugin looseApplication is not enabled"],
                "buildLog": undefined
            },
            "combo5": {
                "description": "microprofile project with bad pom.xml due to missing liberty maven plugin",
                "result": "failed",
                "error": "Missing liberty-maven-plugin configuration",
                "buildLog": undefined
            },
            "combo6": {
                "description": "microprofile project with bad pom.xml due to bad profile",
                "result": "failed",
                "error": "A maven profile named 'microclimate' was not found.",
                "buildLog": undefined
            },
            "combo7": {
                "description": "microprofile project with bad pom.xml syntax",
                "result": "failed",
                "error": "POM parsing error",
                "buildLog": undefined
            }
        };

        for (const combo of Object.keys(combinations)) {
            const description = combinations[combo]["description"];
            const expectedResult = combinations[combo]["result"];
            const errorMsg: any = combinations[combo]["error"];
            const buildLog = combinations[combo]["buildLog"];

            it(combo + " => validate: " + description, async () => {
                await locale.setLocale(["en"]);
                socketData = "";

                const projectInfo: ProjectInfo = await await projectsController.updateProjectInfo("dummymicroprofileproject", keyValuePair);
                const operation = new Operation("", projectInfo);
                let testLibertyMavenBuildLog;
                let libertyMavenBuildLogContents;

                switch (combo) {
                    case "combo2": {
                        fs.renameSync(testLibertyDockerfile, testLibertyDockerfileGarbage);
                        break;
                    }
                    case "combo3": {
                        const projectLocation = projectInfo.location;
                        const projectName = projectLocation.split("/").pop();
                        const libertyLogsDir = path.join(constants.projectConstants.projectsLogDir, projectName + "-" + projectInfo.projectID);
                        testLibertyMavenBuildLog = path.join(libertyLogsDir, "maven.build.log");

                        if (!await existsAsync(libertyLogsDir)) {
                            await mkdirAsync(libertyLogsDir);
                        }

                        await openAsync(testLibertyMavenBuildLog, "w");

                        fs.renameSync(testLibertyServerXML, testLibertyServerXMLGarbage);
                        break;
                    }
                    case "combo4": {
                        await copyAsync(originalLibertyPOMGarbage1, testLibertyPOM);
                        break;
                    }
                    case "combo5": {
                        await copyAsync(originalLibertyPOMGarbage2, testLibertyPOM);
                        break;
                    }
                    case "combo6": {
                        await copyAsync(originalLibertyPOMGarbage3, testLibertyPOM);
                        break;
                    }
                    case "combo7": {
                        await copyAsync(originalLibertyPOMGarbage4, testLibertyPOM);
                        break;
                    }
                }

                await libertyProject.validate(operation);

                switch (combo) {
                    case "combo2": {
                        fs.renameSync(testLibertyDockerfileGarbage, testLibertyDockerfile);
                        break;
                    }
                    case "combo3": {
                        await fs.renameSync(testLibertyServerXMLGarbage, testLibertyServerXML);
                        libertyMavenBuildLogContents = await readAsync(testLibertyMavenBuildLog);
                        expect(libertyMavenBuildLogContents.toString()).to.contain(buildLog);
                        break;
                    }
                    case "combo4":
                    case "combo5":
                    case "combo6":
                    case "combo7": {
                        await copyAsync(originalLibertyPOM, testLibertyPOM);
                        break;
                    }
                }

                expect(socketData).to.exist;
                expect(socketData.status).to.equal(expectedResult);

                if (socketData.status == "failed") {
                    if (combo == "combo4") {
                        expect(socketData.results[0].label).to.equal(errorMsg[0]);
                        expect(socketData.results[1].label).to.equal(errorMsg[1]);
                        expect(socketData.results[2].label).to.equal(errorMsg[2]);
                        expect(socketData.results[3].label).to.equal(errorMsg[3]);
                        expect(socketData.results[4].label).to.equal(errorMsg[4]);
                    } else {
                        expect(socketData.results[0].label).to.equal(errorMsg);
                    }
                }
            });
        }
    });
}