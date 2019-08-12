import { expect } from "chai";
import * as path from "path";
import * as fs from "fs";
import * as app_configs from "../../functional-test/configs/app.config";
import { existsAsync, mkdirAsync, copyAsync, rmdirAsync, unlinkAsync, writeAsync, openAsync } from "../../functional-test/lib/utils";
import * as actions from "../../../src/projects/actions";
import { workspaceConstants, projectConstants } from "../../../src/projects/constants";
import * as socket from "../../../src/utils/socket";
import * as locale from "../../../src/utils/locale";


export function actionsTestModule(): void {
    let socketData: any;

    socket.registerListener({
        name: "codewindunittest",
        handleEvent: (event, data) => {
            console.log("socket event: " + event);
            console.log("socket data: " + JSON.stringify(data));
            if (event === "projectValidated") {
                socketData = data;
            }
        }
    });
    describe.skip("combinational testing of build function", () => {
        // only test the failure case, since success case requires the app container up and running
        const combinations: any = {
            "combo1": {
                "args": {},
                "result": "BAD_REQUEST"
            },
            "combo2": {
                "args": { projectID: "testprojectID" },
                "result": "FILE_NOT_EXIST"
            }
        };

        for (const combo of Object.keys(combinations)) {
            const args = combinations[combo]["args"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => args: " + JSON.stringify(args) , async() => {
                try {
                    await actions.build(args);
                } catch (err) {
                    expect(err.name).to.equal(expectedResult);
                }
            });
        }
    });

    describe.skip("combinational testing of restart function", () => {
        // only test the failure case, since success case requires the app container up and running
        const combinations: any = {
            "combo1": {
                "args": {},
                "result": "BAD_REQUEST: The project id was not provided"
            },
            "combo2": {
                "args": { projectID: "testprojectID" },
                "result": "BAD_REQUEST: The startMode was not provided"
            },
            "combo3": {
                "args": { projectID: "testprojectID", startMode: "invalidStartMode"},
                "result": 'BAD_REQUEST: The startMode "invalidStartMode" is not recognized'
            },
            "combo4": {
                "args": { projectID: "testprojectID", startMode: "run"},
                "K8": false,
                "result": "FILE_NOT_EXIST: No project found for project id: testprojectID"
            },
            "combo5": {
                "args": { projectID: "testprojectID", startMode: "run"},
                "K8": true,
                "result": "BAD_REQUEST: Restart is not supported for Kubernetes"
            },
        };

        for (const combo of Object.keys(combinations)) {
            const args = combinations[combo]["args"];
            const expectedResult = combinations[combo]["result"];
            const K8 = combinations[combo]["K8"];

            it(combo + " => args: " + JSON.stringify(args) , async() => {
                try {
                    if (K8 === true) {
                        process.env.IN_K8 = "true";
                    }
                    await actions.restart(args);
                    process.env.IN_K8 = "false";
                } catch (err) {
                    expect(err.toString()).to.equal(expectedResult);
                }
            });
        }
    });

    describe.skip("combinational testing of enableautobuild & disableautobuild function", () => {

        const nodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const nodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const nodeTestProjectMetadata = path.join(nodeProjectMetadataPath, "dummynodeproject.json");

        const swiftProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyswiftproject");
        const swiftOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyswiftproject.json");
        const swiftTestProjectMetadata = path.join(swiftProjectMetadataPath, "dummyswiftproject.json");

        const springProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyspringproject");
        const springOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyspringproject.json");
        const springTestProjectMetadata = path.join(springProjectMetadataPath, "dummyspringproject.json");

        const libertyProjectMetadataPath = path.join(app_configs.projectDataDir, "dummymicroprofileproject");
        const libertyOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummymicroprofileproject.json");
        const libertyTestProjectMetadata = path.join(libertyProjectMetadataPath, "dummymicroprofileproject.json");

        const goProjectMetadataPath = path.join(app_configs.projectDataDir, "dummygoproject");
        const goOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummygoproject.json");
        const goTestProjectMetadata = path.join(goProjectMetadataPath, "dummygoproject.json");

        const appsodyNodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyappsodyproject");
        const appsodyNodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyappsodyproject.json");
        const appsodyNodeTestProjectMetadata = path.join(appsodyNodeProjectMetadataPath, "dummyappsodyproject.json");

        const extensionsPath = workspaceConstants.workspaceExtensionDir;
        const appsodyExtensionPath = path.join(extensionsPath, "appsodyExtension");

        const appsodyExtensionTestArtifactPath1 = path.join(appsodyExtensionPath, ".sh-extension");
        const appsodyExtensionTestArtifactPath2 = path.join(appsodyExtensionPath, "entrypoint.sh");


        before("create test directories", async () => {
            if (!(await existsAsync(nodeProjectMetadataPath))) {
                await mkdirAsync(nodeProjectMetadataPath);
                await copyAsync(nodeOriginalProjectMetadata, nodeTestProjectMetadata);
            }

            if (!(await existsAsync(swiftProjectMetadataPath))) {
                await mkdirAsync(swiftProjectMetadataPath);
                await copyAsync(swiftOriginalProjectMetadata, swiftTestProjectMetadata);
            }

            if (!(await existsAsync(springProjectMetadataPath))) {
                await mkdirAsync(springProjectMetadataPath);
                await copyAsync(springOriginalProjectMetadata, springTestProjectMetadata);
            }

            if (!(await existsAsync(libertyProjectMetadataPath))) {
                await mkdirAsync(libertyProjectMetadataPath);
                await copyAsync(libertyOriginalProjectMetadata, libertyTestProjectMetadata);
            }

            if (!(await existsAsync(goProjectMetadataPath))) {
                await mkdirAsync(goProjectMetadataPath);
                await copyAsync(goOriginalProjectMetadata, goTestProjectMetadata);
            }

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
            if ((await existsAsync(nodeProjectMetadataPath))) {
                await unlinkAsync(nodeTestProjectMetadata);
                await rmdirAsync(nodeProjectMetadataPath);
            }

            if ((await existsAsync(swiftProjectMetadataPath))) {
                await unlinkAsync(swiftTestProjectMetadata);
                await rmdirAsync(swiftProjectMetadataPath);
            }

            if ((await existsAsync(springProjectMetadataPath))) {
                await unlinkAsync(springTestProjectMetadata);
                await rmdirAsync(springProjectMetadataPath);
            }

            if ((await existsAsync(libertyProjectMetadataPath))) {
                await unlinkAsync(libertyTestProjectMetadata);
                await rmdirAsync(libertyProjectMetadataPath);
            }

            if ((await existsAsync(goProjectMetadataPath))) {
                await unlinkAsync(goTestProjectMetadata);
                await rmdirAsync(goProjectMetadataPath);
            }

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
            "combo1": {
                "args": {},
                "result": "BAD_REQUEST"
            },
            "combo2": {
                "args": { projectID: "dummynodeproject" },
                "result": "success"
            },
            "combo3": {
                "args": { projectID: "dummyswiftproject" },
                "result": "success"
            },
            "combo4": {
                "args": { projectID: "dummyspringproject" },
                "result": "success"
            },
            "combo5": {
                "args": { projectID: "dummymicroprofileproject" },
                "result": "success"
            },
            "combo6": {
                "args": { projectID: "dummygoproject" },
                "result": "success"
            },
            "combo7": {
                "args": { projectID: "dummyappsodyproject" },
                "result": "success"
            },
        };

        for (const combo of Object.keys(combinations)) {
            const args = combinations[combo]["args"];
            const expectedResult = combinations[combo]["result"];

            it(combo + "enableautobuild => args: " + JSON.stringify(args) , async() => {
                try {
                    const actualResult = await actions.enableautobuild(args);
                    expect(actualResult.status).to.equal(expectedResult);
                } catch (err) {
                    expect(err.name).to.equal(expectedResult);
                }
            });

            it(combo + "disableautobuild => args: " + JSON.stringify(args) , async() => {
                try {
                    const actualResult = await actions.disableautobuild(args);
                    expect(actualResult.status).to.equal(expectedResult);
                } catch (err) {
                    expect(err.name).to.equal(expectedResult);
                }
            });
        }
    });

    describe("combinational testing of validate function", () => {
        const libertyProjectPath = path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate");
        const testLibertyServerXMLPath = path.join(libertyProjectPath, "/src/main/liberty/config/");
        const testLibertyServerXML = path.join(testLibertyServerXMLPath, "server.xml");
        const serverXMLbackup = path.join(testLibertyServerXMLPath, "server_backup.xml");
        const testLibertyPOM = path.join(libertyProjectPath, "pom.xml");
        const libertyPOMbackup = path.join(libertyProjectPath, "pom_backup.xml");
        const testLibertyDockerfile = path.join(libertyProjectPath, "Dockerfile");
        const Dockerfilebackup = path.join(libertyProjectPath, "Dockerfile_backup");
        const testLibertyDockerfileBuild = path.join(libertyProjectPath, "Dockerfile-build");

        // const testLibertyDockerfileGarbage = path.join(libertyDummyProjectPath, "DockerfileGarbage");
        // const testLibertyServerXMLGarbage = path.join(testLibertyServerXMLPath, "serverGarbage.xml");

        const originalLibertyPOMGarbage1 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage1.xml");
        const originalLibertyPOMGarbage2 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage2.xml");
        // const originalLibertyPOMGarbage3 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage3.xml");
        // const originalLibertyPOMGarbage4 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage4.xml");
        const combinations: any = {
            "combo1": {
                "description": "request missing project type and location",
                "args": {},
                "result": "BAD_REQUEST: Validation requires a project type and location."
            },
            "combo2": {
                "description": "request with invalidProjectType",
                "args": {
                    projectType: "invalidProjectType",
                    location: "test/projectName"
                },
                "result": "BAD_REQUEST: The project type invalidProjectType is not supported"
            },
            "combo3": {
                "description": "request with non-exist project location",
                "args": {
                    projectType: "liberty",
                    location: "test/projectName"
                },
                "result": "FILE_NOT_EXIST: The provided location does not exist: test/projectName"
            },
            "combo4": {
                "description": "good microprofile project",
                "args": {
                    projectType: "liberty",
                    projectID: "javaMicroProfileTemplate",
                    location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
                },
                "result": "success"
            },
            "combo5": {
                "description": "microprofile project with missing Dockerfile",
                "args": {
                    projectType: "liberty",
                    projectID: "javaMicroProfileTemplate",
                    location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
                },
                "result": "failed",
                "error": "Missing required file",
            },
            "combo6": {
                "description": "microprofile project with missing server.xml",
                "args": {
                    projectType: "liberty",
                    projectID: "javaMicroProfileTemplate",
                    location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
                },
                "result": "failed",
                "error": "Missing required file"
            },
            "combo7": {
                "description": "microprofile project with bad inner most pom.xml elements",
                "args": {
                    projectType: "liberty",
                    projectID: "javaMicroProfileTemplate",
                    location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
                },
                "result": "failed",
                // "error": ["Missing Liberty parent POM groupId", "Missing Liberty parent POM artifactId", "Missing profile activation", "liberty-maven-plugin extensions not enabled", "liberty-maven-plugin looseApplication is not enabled"],
                "error": ["Missing Liberty parent POM groupId", "Missing Liberty parent POM artifactId", "Missing profile activation"],
            },
            "combo8": {
                "description": "microprofile project with bad pom.xml due to missing liberty maven plugin",
                "args": {
                    projectType: "liberty",
                    projectID: "javaMicroProfileTemplate",
                    location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
                },
                "result": "failed",
                "error": "Missing liberty-maven-plugin configuration"
            },
            // "combo5": {
            //     "args": { projectID: "dummymicroprofileproject" },
            //     "result": "success"
            // },
            // "combo6": {
            //     "args": { projectID: "dummygoproject" },
            //     "result": "success"
            // },
            // "combo7": {
            //     "args": { projectID: "dummyappsodyproject" },
            //     "result": "success"
            // },
        };

        for (const combo of Object.keys(combinations)) {
            const args = combinations[combo]["args"];
            const expectedResult = combinations[combo]["result"];
            const errorMsg: any = combinations[combo]["error"];
            const description = combinations[combo]["description"];

            it(combo + " => validate: " + description , async() => {
                socketData = "";
                await locale.setLocale(["en"]);
                try {
                    switch (combo) {
                        case "combo5": {
                            fs.renameSync(testLibertyDockerfile, Dockerfilebackup);
                            break;
                        }
                        case "combo6": {
                            fs.renameSync(testLibertyServerXML, serverXMLbackup);
                            break;
                        }
                        case "combo7": {
                            await copyAsync(originalLibertyPOMGarbage1, testLibertyPOM);
                            break;
                        }
                        case "combo8": {
                            await copyAsync(originalLibertyPOMGarbage2, testLibertyPOM);
                            break;
                        }
                    }
                    const actualResult = await actions.validate(args);
                    switch (combo) {
                        case "combo5": {
                            fs.renameSync(Dockerfilebackup, testLibertyDockerfile);
                            break;
                        }
                        case "combo6": {
                            fs.renameSync(serverXMLbackup, testLibertyServerXML);
                            break;
                        }
                    }
                    expect(JSON.stringify(actualResult)).to.contain("operationId");
                    expect(socketData).to.exist;
                    expect(socketData.status).to.equal(expectedResult);
                    if (socketData.status == "failed") {
                        if (combo == "combo7") {
                            expect(socketData.results[0].label).to.equal(errorMsg[0]);
                            expect(socketData.results[1].label).to.equal(errorMsg[1]);
                            expect(socketData.results[2].label).to.equal(errorMsg[2]);
                        } else {
                            expect(socketData.results[0].label).to.equal(errorMsg);
                        }
                    }
                } catch (err) {
                    expect(err.toString()).to.equal(expectedResult);
                }
            });
        }
    });

}