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
import * as crypto from "crypto";
import { TransformOptions } from "stream";
import * as projectUtil from "../../../../server/src/projects/projectUtil";
import * as logHelperModule from "../lib/logHelper.module";
import * as logHelper from "../../../../server/src/projects/logHelper";
import * as libertyProject from "../../../../server/src/projects/libertyProject";
import { existsAsync, mkdirAsync, writeAsync, copyAsync } from "../../functional-test/lib/utils";
import * as projectsController from "../../../../server/src/controllers/projectsController";
import { projectConstants } from "../../../../server/src/projects/constants";
import * as app_configs from "../../functional-test/configs/app.config";

export function projectUtilTestModule(): void {
    const extensionIDDir = path.join(process.env.CW_EXTENSION_DIR, "extensionProject");
    it("test of getLogName function", async () => {
        const projectID = "testProjectID";
        const projectLocation = "directory/testproject";
        const hash = crypto.createHash("sha1", <TransformOptions>"utf8").update(projectLocation);

        const expectedResult  = projectConstants.containerPrefix + projectID + "-" + hash.digest("hex");
        const actualResult = await projectUtil.getLogName(projectID, projectLocation);
        expect(actualResult).to.equal(expectedResult);
    });

    it("test of getLogName function on Kube", () => {
        const projectID = "testProjectID";
        const projectLocation = "directory/testproject";
        const hash = crypto.createHash("sha1", <TransformOptions>"utf8").update(projectLocation);
        let expectedResult  = projectConstants.containerPrefix + projectID + "-" + hash.digest("hex");
        if (expectedResult.length > 53) {
            expectedResult = expectedResult.substring(0, 53);
        }
        process.env.IN_K8 = "true";
        const actualResult = projectUtil.getLogName(projectID, projectLocation);
        expect(actualResult).to.equal(expectedResult);
        process.env.IN_K8 = "false";
    });

    describe("combinational testing of of getContainerName function", async () => {
        before("create the extension directory with some fake files", async () => {
            if (!(await existsAsync(extensionIDDir))) {
                await mkdirAsync(extensionIDDir, { recursive: true });
            }
            expect(fs.statSync(extensionIDDir)).to.exist;
            const filePath = path.resolve(extensionIDDir, ".sh-extension");
            await writeAsync(filePath, '{"container": {"prefix": "testprefix-", "suffix": "-testsuffix"}}');
            const entryPoint = path.resolve(extensionIDDir, "entrypoint.sh");
            await writeAsync(entryPoint, "echo $(pwd)");
            fs.chmodSync(entryPoint, 0o777);
        });

        after("remove the extension directory", async () => {
            await projectsController.deleteFolder(extensionIDDir);
            try {
                fs.statSync(extensionIDDir);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
            process.env.IN_K8 = "false";
        });

        const combinations: any = {
            "combo1": {
                "data": {
                    projectID: "testProjectID",
                    location: "directory/testproject",
                    extensionID: "extensionProject",
                    projectType: "extensionProject"
                },
                "result": "testprefix-testproject-testsuffix"
            },
            "combo2": {
                "data": {
                    projectID: "testProjectID",
                    location: "directory/testproject",
                    projectType: "liberty"
                },
                "result": projectConstants.containerPrefix + "testproject-testProjectID"
            },
            "combo3": {
                "data": {
                    projectID: "veryveryveryveryveryve-rylongtestProjectID",
                    location: "directory/veryveryveryveryveryveryveryverylongTestProject/",
                    projectType: "liberty"
                },
                "K8": true,
                "result": "cw-veryveryveryveryveryver-veryveryveryveryveryve"
            },
        };
        for (const combo of Object.keys(combinations)) {

            const data = combinations[combo]["data"];
            const expectedResult = combinations[combo]["result"];
            const K8 = combinations[combo]["K8"];
            it(combo + " => data: " + JSON.stringify(data), async() => {
                if (K8) {
                    process.env.IN_K8 = "true";
                }
                const actualResult = await projectUtil.getContainerName(data);
                expect(actualResult).to.equal(expectedResult);
            });
        }
    });


    describe("combinational testing of getProjectMavenSettings function", () => {
        const projectID = "testProjectID";
        const combinations: any = {
            "combo1": {
                "data": {
                    projectID: projectID
                },
                "result": ""
            },
            "combo2": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: ""
                },
                "result": ""
            },
            "combo3": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: [""],
                    mavenProperties: [""]
                },
                "result": ""
            },
            "combo4": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: ["profile1&"]
                },
                "result": "Error: The user maven settings have invalid characters for the project"
            },
            "combo5": {
                "data": {
                    projectID: projectID,
                    mavenProperties: ["key=value;"]
                },
                "result": "Error: The user maven settings have invalid characters for the project"
            },
            "combo6": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: ["profile1"],
                    mavenProperties: ["key=value"]
                },
                "result": "-P profile1 -D key=value "
            },
            "combo7": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: ["profile1", "profile2"],
                    mavenProperties: ["key1=value1", "key2=value2"]
                },
                "result": "-P profile1,profile2 -D key1=value1 -D key2=value2 "
            },
        };
        for (const combo of Object.keys(combinations)) {

            const data = combinations[combo]["data"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => data: " + JSON.stringify(data), async() => {
                try {
                    const actualResult = await projectUtil.getProjectMavenSettings(data);
                    expect(actualResult).to.equal(expectedResult);
                } catch (err) {
                    expect(err.toString()).to.equal(expectedResult);
                }
            });
        }
    });


    describe("combinational testing of getProjectLogs function", () => {
        const testProjectId = "1234";
        const testProjectName = "abcd";
        let logDirectory: string;
        let dirName: string;
        let appLogDirectory: string;
        const projectFolder = process.env.CW_WORKSPACE + "/" + testProjectName;

        before("create a log directory with some fake log files", async () => {
            process.chdir(process.env.CW_LOGS_DIR);

            dirName = await logHelper.getLogDir(testProjectId, testProjectName);
            logDirectory = path.resolve(process.cwd(), dirName);

            await logHelper.createLogDir(dirName, process.cwd());
            expect(fs.statSync(logDirectory)).to.exist;

            appLogDirectory = path.resolve(process.env.CW_WORKSPACE + "/" + testProjectName + "/mc-target/liberty/wlp/usr/servers/defaultServer/logs/");
            if (!(await existsAsync(appLogDirectory))) {
                await mkdirAsync(appLogDirectory, { recursive: true });
            }
            expect(fs.statSync(appLogDirectory)).to.exist;

            if (!(await existsAsync(extensionIDDir))) {
                await mkdirAsync(extensionIDDir, { recursive: true });
            }
            expect(fs.statSync(extensionIDDir)).to.exist;
            const filePath = path.resolve(extensionIDDir, ".sh-extension");
            await writeAsync(filePath, '{"buildLogs": ["buildLog"], "appLogs": ["appLog"]}');
            const entryPoint = path.resolve(extensionIDDir, "entrypoint.sh");
            await writeAsync(entryPoint, "echo $(pwd)");
            fs.chmodSync(entryPoint, 0o777);

        });

        after("remove the log directory", async () => {
            await logHelper.removeLogDir(dirName, process.cwd());
            try {
                fs.statSync(logDirectory);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
            await projectsController.deleteFolder(projectFolder);
            try {
                fs.statSync(projectFolder);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
            await projectsController.deleteFolder(extensionIDDir);
            try {
                fs.statSync(extensionIDDir);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
        });
        const combinations: any = {
            "combo1": {
                "data": {
                    projectID: testProjectId,
                    location: projectFolder,
                    logSuffixes: ["log1"],
                    projectType: "liberty"
                },
                "result":  {
                    "build": {
                        "origin": "workspace",
                        "files": []
                    },
                    "app": {
                        "origin": "workspace",
                        "files": []
                    }}
            },
            "combo2": {
                "data": {
                    projectID: testProjectId,
                    location: projectFolder,
                    logSuffixes: [logHelper.buildLogs.dockerBuild, logHelper.buildLogs.mavenBuild],
                    projectType: "liberty"
                },
                "result":  {
                    "build": {
                        "origin": "workspace",
                        "files": [ process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.mavenBuild + ".log", process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerBuild + ".log"]
                    },
                    "app": {
                        "origin": "workspace",
                        "files": []
                    }}
            },
            "combo3": {
                "data": {
                    projectID: testProjectId,
                    location: projectFolder,
                    logSuffixes: [logHelper.buildLogs.dockerBuild, logHelper.buildLogs.mavenBuild],
                    projectType: "liberty"
                },
                "appLogTest": true,
                "result":  {
                    "build": {
                        "origin": "workspace",
                        "files": [ process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.mavenBuild + ".log", process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerBuild + ".log"]
                    },
                    "app": {
                        "origin": "workspace",
                        "dir": process.env.CW_WORKSPACE + "/" + testProjectName + "/mc-target/liberty/wlp/usr/servers/defaultServer/logs/ffdc",
                        "files": [ process.env.CW_WORKSPACE + "/" + testProjectName + "/mc-target/liberty/wlp/usr/servers/defaultServer/logs/console.log",  process.env.CW_WORKSPACE + "/" + testProjectName + "/mc-target/liberty/wlp/usr/servers/defaultServer/logs/messages.log"]
                    }}
            },
            "combo4": {
                "data": {
                    projectID: testProjectId,
                    location: projectFolder,
                    logSuffixes: [logHelper.buildLogs.dockerBuild, logHelper.buildLogs.mavenBuild],
                    projectType: "spring"
                },
                "appLogTest": true,
                "result":  {
                    "build": {
                        "origin": "workspace",
                        "files": [ process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.mavenBuild + ".log", process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerBuild + ".log"]
                    },
                    "app": {
                        "origin": "workspace",
                        "files": [process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.appLogs.app + ".log"]
                    }}
            },
            "combo5": {
                "data": {
                    projectID: "invalidProjectID",
                    location: "invalidProjectLocation",
                    logSuffixes: ["log1"],
                    projectType: "invalidProjectType"
                },
                "result":  {
                    "build": {
                        "origin": "workspace",
                        "files": []
                    },
                    "app": {
                        "origin": "workspace",
                        "files": []
                    }}
            },
            "combo6": {
                "data": {
                    projectID: testProjectId,
                    location: projectFolder,
                    logSuffixes: [logHelper.buildLogs.dockerBuild],
                    projectType: "nodejs"
                },
                "appLogTest": true,
                "result":  {
                    "build": {
                        "origin": "workspace",
                        "files": [ process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerBuild + ".log"]
                    },
                    "app": {
                        "origin": "workspace",
                        "files": [process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.appLogs.app + ".log"]
                    }}
            },
            "combo7": {
                "data": {
                    projectID: testProjectId,
                    location: projectFolder,
                    logSuffixes: [logHelper.buildLogs.dockerBuild, logHelper.buildLogs.dockerApp, logHelper.buildLogs.appCompilation],
                    projectType: "swift"
                },
                "appLogTest": true,
                "result":  {
                    "build": {
                        "origin": "workspace",
                        "files": [ process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerBuild + ".log",  process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerApp + ".log", process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.appCompilation + ".log"]
                    },
                    "app": {
                        "origin": "workspace",
                        "files": [process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.appLogs.app + ".log"]
                    }}
            },
            "combo8": {
                "data": {
                    projectID: testProjectId,
                    location: projectFolder,
                    logSuffixes: [logHelper.buildLogs.dockerBuild],
                    projectType: "docker"
                },
                "appLogTest": true,
                "result":  {
                    "build": {
                        "origin": "workspace",
                        "files": [ process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerBuild + ".log"]
                    },
                    "app": {
                        "origin": "workspace",
                        "files": [process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.appLogs.app + ".log"]
                    }}
            },
            "combo9": {
                "data": {
                    projectID: testProjectId,
                    location: projectFolder,
                    logSuffixes: ["buildLog", "appLog"],
                    extensionID: "extensionProject",
                    projectType: "extensionProject"
                },
                "appLogTest": true,
                "result":  {
                    "build": {
                        "origin": "workspace",
                        "files": [ process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/buildLog.log"]
                    },
                    "app": {
                        "origin": "workspace",
                        "files": [process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/appLog.log"]
                    }}
            },
        };
        for (const combo of Object.keys(combinations)) {

            const data = combinations[combo]["data"];
            const expectedResult = combinations[combo]["result"];
            const appLogTest = combinations[combo]["appLogTest"];
            const logSuffixes: string[] = data.logSuffixes;
            it(combo + " => data: " + JSON.stringify(data), async() => {
                    for (const suffix of logSuffixes) {
                        const file = suffix + logHelperModule.getlogExtension();
                        const filePath = path.resolve(logDirectory, file);
                        await writeAsync(filePath, "some data");
                    }
                    if (appLogTest && data.projectType === "liberty") {
                        const consoleLogPath = path.resolve(appLogDirectory, libertyProject.libertyAppLogs.console + ".log" );
                        await writeAsync(consoleLogPath, "some data");
                        const messagesLogPath = path.resolve(appLogDirectory, libertyProject.libertyAppLogs.messages + ".log");
                        await writeAsync(messagesLogPath, "some data");
                        const ffdcDir = path.resolve(appLogDirectory, "ffdc" );
                        await mkdirAsync(ffdcDir);
                    } else if (appLogTest) {
                        const appLogPath = path.resolve(process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId, logHelper.appLogs.app + ".log");
                        await writeAsync(appLogPath, "some data");
                    }
                    const actualResult = await projectUtil.getProjectLogs(data);
                    expect(actualResult.build.files.length).to.equal(expectedResult.build.files.length);
                    expect(actualResult.build.files).to.have.all.members(expectedResult.build.files);
                    expect(actualResult.app.files.length).to.equal(expectedResult.app.files.length);
                    expect(actualResult.app.files).to.have.all.members(expectedResult.app.files);
                    if (expectedResult.app.dir) {
                        expect(actualResult.app.dir).to.equal(expectedResult.app.dir);
                    }
            });
        }
    });

    describe("combinational testing of of setprojectList function", () => {

        const nodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const nodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const nodeTestProjectMetadata = path.join(nodeProjectMetadataPath, "dummynodeproject.json");

        const swiftProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyswiftproject");
        const swiftOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyswiftproject.json");
        const swiftTestProjectMetadata = path.join(swiftProjectMetadataPath, "dummyswiftproject.json");

        before("create test directories", async () => {
            if (!(await existsAsync(nodeProjectMetadataPath))) {
                await mkdirAsync(nodeProjectMetadataPath);
                await copyAsync(nodeOriginalProjectMetadata, nodeTestProjectMetadata);
            }

            if (!(await existsAsync(swiftProjectMetadataPath))) {
                await mkdirAsync(swiftProjectMetadataPath);
                await copyAsync(swiftOriginalProjectMetadata, swiftTestProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(nodeProjectMetadataPath))) {
                await projectsController.deleteFolder(nodeProjectMetadataPath);
            }
            try {
                fs.statSync(nodeProjectMetadataPath);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }

            if ((await existsAsync(swiftProjectMetadataPath))) {
                await projectsController.deleteFolder(swiftProjectMetadataPath);
            }
            try {
                fs.statSync(swiftProjectMetadataPath);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
        });
    });

    describe("combinational testing of of getUserFriendlyProjectType function", () => {
        const combinations: any = {
            "combo1": {
                "projectType": "liberty",
                "result": "Microprofile"
            },
            "combo2": {
                "projectType": "spring",
                "result": "Spring"
            },
            "combo3": {
                "projectType": "swift",
                "result": "Swift"
            },
            "combo4": {
                "projectType": "nodejs",
                "result": "Node.js"
            },
            "combo5": {
                "projectType": "docker",
                "result": "Docker"
            },
            "combo6": {
                "projectType": "testprojecttype",
                "result": "Testprojecttype"
            },
        };
        for (const combo of Object.keys(combinations)) {

            const projectType = combinations[combo]["projectType"];
            const expectedResult = combinations[combo]["result"];
            it(combo + " => projectType: " + projectType, async() => {
                const actualResult = await projectUtil.getUserFriendlyProjectType(projectType);
                expect(actualResult).to.equal(expectedResult);
            });
        }
    });
}
