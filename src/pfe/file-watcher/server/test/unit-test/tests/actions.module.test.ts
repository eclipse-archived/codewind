import { expect } from "chai";
import * as path from "path";
import * as fs from "fs";
import * as fse from "fs-extra";
import * as app_configs from "../../functional-test/configs/app.config";
import { existsAsync, mkdirAsync, copyAsync, rmdirAsync, unlinkAsync, writeAsync, openAsync } from "../../functional-test/lib/utils";
import * as actions from "../../../src/projects/actions";
import { workspaceConstants, projectConstants } from "../../../src/projects/constants";
import * as socket from "../../../src/utils/socket";
import * as locale from "../../../src/utils/locale";
import * as timeout_configs from "../../functional-test/configs/timeout.config";


export function actionsTestModule(): void {
    let socketData: any;
    const extensionsPath = workspaceConstants.workspaceExtensionDir;
    const appsodyExtensionPath = path.join(extensionsPath, "appsodyExtension");

    const appsodyExtensionTestArtifactPath1 = path.join(appsodyExtensionPath, ".sh-extension");
    const appsodyExtensionTestArtifactPath2 = path.join(appsodyExtensionPath, "entrypoint.sh");

    socket.registerListener({
        name: "codewindunittest",
        handleEvent: (event, data) => {
            if (event === "projectValidated") {
                socketData = data;
            }
        }
    });
    describe("combinational testing of build function", () => {
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

    describe("combinational testing of restart function", () => {
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

    describe("combinational testing of enableautobuild & disableautobuild function", () => {

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

            if (!(await existsAsync(appsodyExtensionPath))) {
                fse.ensureDirSync(appsodyExtensionPath);
                await writeAsync(appsodyExtensionTestArtifactPath1, '{"container": {"prefix": "testprefix-", "suffix": "-testsuffix"}}');
                await writeAsync(appsodyExtensionTestArtifactPath2, "echo $(pwd)");
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

    describe.only("combinational testing of validate function", () => {
        const libertyProjectPath = path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate");
        const testLibertyServerXMLPath = path.join(libertyProjectPath, "/src/main/liberty/config/");
        const testLibertyServerXML = path.join(testLibertyServerXMLPath, "server.xml");
        const serverXMLbackup = path.join(testLibertyServerXMLPath, "server_backup.xml");
        const testLibertyPOM = path.join(libertyProjectPath, "pom.xml");
        const testLibertyDockerfile = path.join(libertyProjectPath, "Dockerfile");
        const libertyDockerfilebackup = path.join(libertyProjectPath, "Dockerfile_backup");
        const testLibertyDockerfileBuild = path.join(libertyProjectPath, "Dockerfile-build");
        const LibertyDockerfileBuildbackup = path.join(libertyProjectPath, "Dockerfile-build_backup");

        const originalLibertyPOMGarbage1 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage1.xml");
        const originalLibertyPOMGarbage2 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage2.xml");
        const originalLibertyPOMGarbage3 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage3.xml");
        const originalLibertyPOMGarbage4 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage4.xml");
        const originalLibertyPOMGarbage5 = path.join(app_configs.projectDataDir, "dummymicroprofilepomgarbage5.xml");
        const LibertyDockerfileBuildGarbage = path.join(app_configs.projectDataDir, "dummymicroprofiledockerfilebuildgarbage");

        const springProjectPath = path.join(process.env.CW_WORKSPACE, "springJavaTemplate");
        const testspringPOM = path.join(springProjectPath, "pom.xml");
        const testspringDockerfile = path.join(springProjectPath, "Dockerfile");
        const springDockerfilebackup = path.join(springProjectPath, "Dockerfile_backup");
        const originalspringPOMGarbage1 = path.join(app_configs.projectDataDir, "dummyspringpomgarbage1.xml");

        const nodeProjectPath = path.join(process.env.CW_WORKSPACE, "nodeExpressTemplate");
        const testnodeDockerfile = path.join(nodeProjectPath, "Dockerfile");
        const nodeDockerfilebackup = path.join(nodeProjectPath, "Dockerfile_backup");
        const testnodePackagejson = path.join(nodeProjectPath, "package.json");
        const nodePackagejsonbackup = path.join(nodeProjectPath, "package.json_backup");

        const swiftProjectPath = path.join(process.env.CW_WORKSPACE, "swiftTemplate");
        const testswiftDockerfiletools = path.join(swiftProjectPath, "Dockerfile-tools");
        const swiftDockerfiletoolsbackup = path.join(swiftProjectPath, "Dockerfile-tools_backup");
        const testswiftPackageswift = path.join(swiftProjectPath, "Package.swift");
        const swiftPackageswiftbackup = path.join(swiftProjectPath, "Package.swift_backup");

        const pythonProjectPath = path.join(process.env.CW_WORKSPACE, "SVTPythonTemplate");
        const testpythonDockerfile = path.join(pythonProjectPath, "Dockerfile");
        const pythonDockerfilebackup = path.join(pythonProjectPath, "Dockerfile_backup");

        const appsodyProjectPath = path.join(process.env.CW_WORKSPACE, "appsodyProject");
        const testappsodyrequiredFiles = path.join(appsodyProjectPath, "testRequiredFiles");

        before("create the required extension folder for shellExtension project testing", async () => {
            process.env.HIDE_PFE_LOG = "n";

            if (!(await existsAsync(appsodyExtensionPath))) {
                fse.ensureDirSync(appsodyExtensionPath);
                await writeAsync(appsodyExtensionTestArtifactPath1, '{"requiredFiles": ["/testRequiredFiles"]}');
                await writeAsync(appsodyExtensionTestArtifactPath2, `echo -n "{ \"language\": \"somestack\" }"`);
                await fs.chmodSync(appsodyExtensionTestArtifactPath2, 0o755);
            }

            expect(fs.statSync(extensionsPath)).to.exist;
            expect(fs.statSync(appsodyExtensionPath)).to.exist;

            if (!(await existsAsync(appsodyProjectPath))) {
                await mkdirAsync(appsodyProjectPath);
            }
            expect(fs.statSync(appsodyProjectPath)).to.exist;
            await writeAsync(testappsodyrequiredFiles, "some data");
        });

        after("cleanup the test directories", async() => {
            process.env.HIDE_PFE_LOG = "y";

            if ((await existsAsync(extensionsPath))) {
                if (await existsAsync(appsodyExtensionPath)) {
                    await unlinkAsync(appsodyExtensionTestArtifactPath1);
                    await unlinkAsync(appsodyExtensionTestArtifactPath2);
                    await rmdirAsync(appsodyExtensionPath);
                }
                await rmdirAsync(extensionsPath);
            }

            if ((await existsAsync(appsodyProjectPath))) {
                if ((await existsAsync(testappsodyrequiredFiles))) {
                    await unlinkAsync(testappsodyrequiredFiles);
                }
                await rmdirAsync(appsodyProjectPath);
            }
        });
        const combinations: any = {
            // "combo1": {
            //     "description": "request missing project type and location",
            //     "args": {},
            //     "result": "BAD_REQUEST: Validation requires a project type and location."
            // },
            // "combo2": {
            //     "description": "request with invalidProjectType",
            //     "args": {
            //         projectType: "invalidProjectType",
            //         projectID: "javaMicroProfileTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
            //     },
            //     "result": "BAD_REQUEST: The project type invalidProjectType is not supported"
            // },
            // "combo3": {
            //     "description": "request with non-exist project location",
            //     "args": {
            //         projectType: "liberty",
            //         location: "test/projectName"
            //     },
            //     "result": "FILE_NOT_EXIST: The provided location does not exist: test/projectName"
            // },
            // "combo4": {
            //     "description": "good microprofile project",
            //     "args": {
            //         projectType: "liberty",
            //         projectID: "javaMicroProfileTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
            //     },
            //     "result": "success"
            // },
            // "combo5": {
            //     "description": "microprofile project with missing Dockerfile",
            //     "args": {
            //         projectType: "liberty",
            //         projectID: "javaMicroProfileTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
            //     },
            //     "result": "failed",
            //     "error": "Missing required file",
            // },
            // "combo6": {
            //     "description": "microprofile project with missing server.xml",
            //     "args": {
            //         projectType: "liberty",
            //         projectID: "javaMicroProfileTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
            //     },
            //     "result": "failed",
            //     "error": "Missing required file"
            // },
            // "combo7": {
            //     "description": "microprofile project with root user dockerfile-build",
            //     "args": {
            //         projectType: "liberty",
            //         projectID: "javaMicroProfileTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
            //     },
            //     "result": "failed",
            //     "error": "Migration may required to run project container as a non-root user"
            // },
            // "combo8": {
            //     "description": "microprofile project with bad inner most pom.xml elements",
            //     "args": {
            //         projectType: "liberty",
            //         projectID: "javaMicroProfileTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
            //     },
            //     "result": "failed",
            //     "error": ["Missing Liberty parent POM groupId", "Missing Liberty parent POM artifactId", "Missing profile activation", "liberty-maven-plugin extensions not enabled", "liberty-maven-plugin looseApplication is not enabled"],
            // },
            // "combo9": {
            //     "description": "microprofile project with bad pom.xml due to missing liberty maven plugin",
            //     "args": {
            //         projectType: "liberty",
            //         projectID: "javaMicroProfileTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
            //     },
            //     "result": "failed",
            //     "error": "Missing liberty-maven-plugin configuration"
            // },
            // "combo10": {
            //     "description": "microprofile project with bad pom.xml due to bad profile",
            //     "args": {
            //         projectType: "liberty",
            //         projectID: "javaMicroProfileTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
            //     },
            //     "result": "failed",
            //     "error": "A maven profile named 'microclimate' was not found."
            // },
            // "combo11": {
            //     "description": "microprofile project with bad pom.xml syntax",
            //     "args": {
            //         projectType: "liberty",
            //         projectID: "javaMicroProfileTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
            //     },
            //     "result": "failed",
            //     "error": "POM parsing error"
            // },
            // "combo12": {
            //     "description": "microprofile project with missing parent in pom",
            //     "args": {
            //         projectType: "liberty",
            //         projectID: "javaMicroProfileTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "javaMicroProfileTemplate")
            //     },
            //     "result": "failed",
            //     "error": "Missing Liberty parent POM"
            // },
            // "combo13": {
            //     "description": "good spring project",
            //     "args": {
            //         projectType: "spring",
            //         projectID: "springJavaTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "springJavaTemplate")
            //     },
            //     "result": "success"
            // },
            // "combo14": {
            //     "description": "spring project with missing Dockerfile",
            //     "args": {
            //         projectType: "spring",
            //         projectID: "springJavaTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "springJavaTemplate")
            //     },
            //     "result": "failed",
            //     "error": "Missing required file",
            // },
            // "combo15": {
            //     "description": "spring project with bad inner most pom.xml elements",
            //     "args": {
            //         projectType: "spring",
            //         projectID: "springJavaTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "springJavaTemplate")
            //     },
            //     "result": "failed",
            //     "error": ["Invalid packaging for Spring project", "Spring Boot dependency not found"],
            // },
            // "combo16": {
            //     "description": "good nodejs project",
            //     "args": {
            //         projectType: "nodejs",
            //         projectID: "nodeExpressTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "nodeExpressTemplate")
            //     },
            //     "result": "success"
            // },
            // "combo17": {
            //     "description": "nodejs project with missing Dockerfile",
            //     "args": {
            //         projectType: "nodejs",
            //         projectID: "nodeExpressTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "nodeExpressTemplate")
            //     },
            //     "result": "failed",
            //     "error": "Missing required file",
            // },
            // "combo18": {
            //     "description": "nodejs project with missing package.json",
            //     "args": {
            //         projectType: "nodejs",
            //         projectID: "nodeExpressTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "nodeExpressTemplate")
            //     },
            //     "result": "failed",
            //     "error": "Missing required file",
            // },
            // "combo19": {
            //     "description": "good swift project",
            //     "args": {
            //         projectType: "swift",
            //         projectID: "swiftTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "swiftTemplate")
            //     },
            //     "result": "success"
            // },
            // "combo20": {
            //     "description": "swift project with missing Dockerfile-tools",
            //     "args": {
            //         projectType: "swift",
            //         projectID: "swiftTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "swiftTemplate")
            //     },
            //     "result": "failed",
            //     "error": "Missing required file",
            // },
            // "combo21": {
            //     "description": "swift project with missing Package.swift",
            //     "args": {
            //         projectType: "swift",
            //         projectID: "swiftTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "swiftTemplate")
            //     },
            //     "result": "failed",
            //     "error": "Missing required file",
            // },
            // "combo22": {
            //     "description": "good python project",
            //     "args": {
            //         projectType: "docker",
            //         projectID: "SVTPythonTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "SVTPythonTemplate")
            //     },
            //     "result": "success"
            // },
            // "combo23": {
            //     "description": "python project with missing Dockerfile",
            //     "args": {
            //         projectType: "docker",
            //         projectID: "SVTPythonTemplate",
            //         location: path.join(process.env.CW_WORKSPACE, "SVTPythonTemplate")
            //     },
            //     "result": "failed",
            //     "error": "Missing required file",
            // },
            "combo24": {
                "description": "good extension project",
                "args": {
                    projectType: "appsodyExtension",
                    extensionID: appsodyExtensionPath,
                    projectID: "appsodyProject",
                    language: "nodejs-express",
                    location: path.join(process.env.CW_WORKSPACE, "appsodyProject")
                },
                "result": "success"
            },
            "combo25": {
                "description": "extension project with missing requiredFiles",
                "args": {
                    projectType: "appsodyExtension",
                    extensionID: appsodyExtensionPath,
                    projectID: "appsodyProject",
                    language: "nodejs-express",
                    location: path.join(process.env.CW_WORKSPACE, "appsodyProject")
                },
                "result": "failed",
                "error": "Missing required file"
            },
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
                            fs.renameSync(testLibertyDockerfile, libertyDockerfilebackup);
                            break;
                        }
                        case "combo6": {
                            fs.renameSync(testLibertyServerXML, serverXMLbackup);
                            break;
                        }
                        case "combo7": {
                            fs.renameSync(testLibertyDockerfileBuild, LibertyDockerfileBuildbackup);
                            await copyAsync(LibertyDockerfileBuildGarbage, testLibertyDockerfileBuild);
                            break;
                        }
                        case "combo8": {
                            await copyAsync(originalLibertyPOMGarbage1, testLibertyPOM);
                            break;
                        }
                        case "combo9": {
                            await copyAsync(originalLibertyPOMGarbage2, testLibertyPOM);
                            break;
                        }
                        case "combo10": {
                            await copyAsync(originalLibertyPOMGarbage3, testLibertyPOM);
                            break;
                        }
                        case "combo11": {
                            await copyAsync(originalLibertyPOMGarbage4, testLibertyPOM);
                            break;
                        }
                        case "combo12": {
                            await copyAsync(originalLibertyPOMGarbage5, testLibertyPOM);
                            break;
                        }
                        case "combo14": {
                            fs.renameSync(testspringDockerfile, springDockerfilebackup);
                            break;
                        }
                        case "combo15": {
                            await copyAsync(originalspringPOMGarbage1, testspringPOM);
                            break;
                        }
                        case "combo17": {
                            fs.renameSync(testnodeDockerfile, nodeDockerfilebackup);
                            break;
                        }
                        case "combo18": {
                            fs.renameSync(testnodePackagejson, nodePackagejsonbackup);
                            break;
                        }
                        case "combo20": {
                            fs.renameSync(testswiftDockerfiletools, swiftDockerfiletoolsbackup);
                            break;
                        }
                        case "combo21": {
                            fs.renameSync(testswiftPackageswift, swiftPackageswiftbackup);
                            break;
                        }
                        case "combo23": {
                            fs.renameSync(testpythonDockerfile, pythonDockerfilebackup);
                            break;
                        }
                        case "combo25": {
                            await unlinkAsync(testappsodyrequiredFiles);
                            break;
                        }
                    }
                    const actualResult = await actions.validate(args);
                    switch (combo) {
                        case "combo5": {
                            fs.renameSync(libertyDockerfilebackup, testLibertyDockerfile);
                            break;
                        }
                        case "combo6": {
                            fs.renameSync(serverXMLbackup, testLibertyServerXML);
                            break;
                        }
                        case "combo7": {
                            await copyAsync(LibertyDockerfileBuildbackup, testLibertyDockerfileBuild);
                            break;
                        }
                        case "combo14": {
                            fs.renameSync(springDockerfilebackup, testspringDockerfile);
                            break;
                        }
                        case "combo17": {
                            fs.renameSync(nodeDockerfilebackup, testnodeDockerfile);
                            break;
                        }
                        case "combo20": {
                            fs.renameSync(swiftDockerfiletoolsbackup, testswiftDockerfiletools);
                            break;
                        }
                    }
                    expect(JSON.stringify(actualResult)).to.contain("operationId");
                    expect(socketData).to.exist;
                    expect(socketData.status).to.equal(expectedResult);
                    if (socketData.status == "failed") {
                        if (combo == "combo8") {
                            expect(socketData.results[0].label).to.equal(errorMsg[0]);
                            expect(socketData.results[1].label).to.equal(errorMsg[1]);
                            expect(socketData.results[2].label).to.equal(errorMsg[2]);
                            expect(socketData.results[3].label).to.equal(errorMsg[3]);
                            expect(socketData.results[4].label).to.equal(errorMsg[4]);
                        } else if (combo == "combo15") {
                            expect(socketData.results[0].label).to.equal(errorMsg[0]);
                            expect(socketData.results[1].label).to.equal(errorMsg[1]);
                        } else {
                            expect(socketData.results[0].label).to.equal(errorMsg);
                        }
                    }
                } catch (err) {
                    expect(err.toString()).to.equal(expectedResult);
                }
            }).timeout(timeout_configs.defaultTimeout);
        }
    });

}