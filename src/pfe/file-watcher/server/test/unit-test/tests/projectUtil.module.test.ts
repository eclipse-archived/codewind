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
import * as fse from "fs-extra";
import crypto from "crypto";
import { TransformOptions } from "stream";
import * as projectUtil from "../../../../server/src/projects/projectUtil";
import * as logHelperModule from "../lib/logHelper.module";
import * as logHelper from "../../../../server/src/projects/logHelper";
import * as libertyProject from "../../../../server/src/projects/libertyProject";
import { existsAsync, mkdirAsync, writeAsync, copyAsync } from "../../functional-test/lib/utils";
import * as projectsController from "../../../../server/src/controllers/projectsController";
import { projectConstants } from "../../../../server/src/projects/constants";

export function projectUtilTestModule(): void {
    const extensionIDDir = path.join(process.env.CW_EXTENSION_DIR, "extensionProject");

    it("test of getLogName function", async () => {
        const projectID = "testID";
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
            fse.ensureDirSync(extensionIDDir);
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
                    extensionID: extensionIDDir,
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
                    mavenProperties: ""
                },
                "result": ""
            },
            "combo4": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: [""],
                    mavenProperties: [""]
                },
                "result": ""
            },
            "combo5": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: ["profile1&"]
                },
                "result": "Error: The user maven settings have invalid characters for the project"
            },
            "combo6": {
                "data": {
                    projectID: projectID,
                    mavenProperties: ["key=value;"]
                },
                "result": "Error: The user maven settings have invalid characters for the project"
            },
            "combo7": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: ["profile1"],
                    mavenProperties: ["key=value"]
                },
                "result": "-P profile1 -D key=value "
            },
            "combo8": {
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

            fse.ensureDirSync(appLogDirectory);
            expect(fs.statSync(appLogDirectory)).to.exist;
            fse.ensureDirSync(extensionIDDir);
            expect(fs.statSync(extensionIDDir)).to.exist;

            const filePath = path.resolve(extensionIDDir, ".sh-extension");
            await writeAsync(filePath, '{"buildWorkspaceLogs": {"files": {"buildLog": null}}, "appWorkspaceLogs": {"files": {"appLog": null}}');
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
                    "build": [],
                    "app": []
                }
            },
            "combo2": {
                "data": {
                    projectID: testProjectId,
                    location: projectFolder,
                    logSuffixes: [logHelper.buildLogs.dockerBuild, logHelper.buildLogs.mavenBuild],
                    projectType: "liberty"
                },
                "result":  {
                    "build": [{
                        "origin": "workspace",
                        "files": [process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerBuild + ".log"]
                    }],
                    "app": []
                }
            },
            // this is being removed because combo3 expected maven.build.log, console.log and messages.log to be in the workspace. now they are moved to the app container
            "combo4": {
                "data": {
                    projectID: testProjectId,
                    location: projectFolder,
                    logSuffixes: [logHelper.buildLogs.dockerBuild, logHelper.buildLogs.mavenBuild],
                    projectType: "spring"
                },
                "appLogTest": true,
                "result":  {
                    "build": [{
                        "origin": "workspace",
                        "files": [process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerBuild + ".log"]
                    }],
                    "app": [{
                        "origin": "workspace",
                        "files": [process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.appLogs.app + ".log"]
                    }]
                }
            },
            "combo5": {
                "data": {
                    projectID: "invalidProjectID",
                    location: "invalidProjectLocation",
                    logSuffixes: ["log1"],
                    projectType: "invalidProjectType"
                },
                "result":  {
                    "build": [],
                    "app": []
                }
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
                    "build": [{
                        "origin": "workspace",
                        "files": [ process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerBuild + ".log"]
                    }],
                    "app": [{
                        "origin": "workspace",
                        "files": [process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.appLogs.app + ".log"]
                    }]
                }
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
                    "build": [{
                        "origin": "workspace",
                        "files": [
                            process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerBuild + ".log",
                            process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerApp + ".log",
                            process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.appCompilation + ".log"
                        ]
                    }],
                    "app": [{
                        "origin": "workspace",
                        "files": [process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.appLogs.app + ".log"]
                    }]
                }
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
                    "build": [{
                        "origin": "workspace",
                        "files": [ process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.buildLogs.dockerBuild + ".log"]
                    }],
                    "app": [{
                        "origin": "workspace",
                        "files": [process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId + "/" + logHelper.appLogs.app + ".log"]
                    }]
                },
            },
            // combo9 is removed because appsody logs need to be loaded through the appsody init function which is beyond the scope of our testing
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
                        const consoleLogPath = path.resolve(appLogDirectory, logHelper.libertyAppLogs.console + ".log" );
                        await writeAsync(consoleLogPath, "some data");
                        const messagesLogPath = path.resolve(appLogDirectory, logHelper.libertyAppLogs.messages + ".log");
                        await writeAsync(messagesLogPath, "some data");
                        const ffdcDir = path.resolve(appLogDirectory, "ffdc" );
                        await mkdirAsync(ffdcDir);
                    } else if (appLogTest) {
                        const appLogPath = path.resolve(process.env.CW_LOGS_DIR + "/" + testProjectName + "-" + testProjectId, logHelper.appLogs.app + ".log");
                        await writeAsync(appLogPath, "some data");
                    }
                    const actualResult = await projectUtil.getProjectLogs(data);
                    expect(actualResult.build.length).to.equal(expectedResult.build.length);
                    expect(actualResult.app.length).to.equal(expectedResult.app.length);
                    if (expectedResult.build.length > 0) {
                        for (let i = 0; i < expectedResult.build.length; i++) {
                            expect(actualResult.build[i].files.length).to.equal(expectedResult.build[i].files.length);
                            expect(actualResult.build[i].files).to.have.all.members(expectedResult.build[i].files);
                        }
                    }
                    if (expectedResult.app.length > 0) {
                        for (let i = 0; i < expectedResult.app.length; i++) {
                            expect(actualResult.app[i].files.length).to.equal(expectedResult.app[i].files.length);
                            expect(actualResult.app[i].files).to.have.all.members(expectedResult.app[i].files);
                            if (expectedResult.app[i].dirs) {
                                expect(actualResult.app[i].dirs).to.equal(expectedResult.app[i].dirs);
                            }
                        }
                    }
            });
        }
    });

    describe("combinational testing of getUserFriendlyProjectType function", () => {
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
