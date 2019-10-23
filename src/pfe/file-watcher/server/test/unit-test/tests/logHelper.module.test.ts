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

import * as logHelperModule from "../lib/logHelper.module";
import * as logHelper from "../../../../server/src/projects/logHelper";

export function logHelperTestModule(): void {
    const testWD = __dirname;

    it("check for build log names", () => {
        const actualBuildLogNames = logHelperModule.getBuildLogNames();
        const expectedBuildLogNames = logHelperModule.expectedBuildLogNames;
        expect(actualBuildLogNames).to.deep.equal(expectedBuildLogNames);
    });

    it("check for app log names", () => {
        const actualAppLogNames = logHelperModule.getAppLogNames();
        const expectedAppLogNames = logHelperModule.expectedAppLogNames;
        expect(actualAppLogNames).to.deep.equal(expectedAppLogNames);
    });

    it("check for log extension", () => {
        const actualExtension = logHelperModule.getlogExtension();
        const exoectedExtension = logHelperModule.logExtension;
        expect(actualExtension).to.equal(exoectedExtension);
    });

    describe("combinational testing of getLogDir function", () => {
        const testProjectId = "1234";
        const testProjectName = "abcd";
        const combinations: any = {
            "combo1": {
                "projectID": testProjectId,
                "projectName": testProjectName,
                "result": testProjectName + "-" + testProjectId
            },
            "combo2": {
                "projectID": undefined,
                "projectName": testProjectName,
                "result": undefined
            },
            "combo3": {
                "projectID": testProjectId,
                "projectName": undefined,
                "result": "ENOENT"
            },
            "combo4": {
                "projectID": undefined,
                "projectName": undefined,
                "result": undefined
            },
        };

        for (const combo of Object.keys(combinations)) {
            const projectID = combinations[combo]["projectID"];
            const projectName = combinations[combo]["projectName"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => projectID: " + projectID + ", projectName: " + projectName, async() => {
                try {
                    const actualResult = await logHelper.getLogDir(projectID, projectName);
                    expect(actualResult).to.equal(expectedResult);
                } catch (err) {
                    expect(err.code).to.equal(expectedResult);
                }
            });
        }
    });

    describe("combinational testing of createLogDir function", () => {
        const testProjectId = "1234";
        const testProjectName = "abcd";

        const combinations: any = {
            "combo1": {
                "dirName": undefined,
                "logPath": undefined,
                "result": undefined,
            },
            "combo2": {
                "dirName": testProjectId + "-" + testProjectName,
                "logPath": undefined,
                "result": undefined
            },
            "combo3": {
                "dirName": undefined,
                "logPath": "xyz",
                "result": undefined
            }
        };

        beforeEach(async () => {
            process.chdir(process.env.CW_LOGS_DIR);
        });

        afterEach(() => {
            process.chdir(testWD);
        });

        for (const combo of Object.keys(combinations)) {
            const dirName = combinations[combo]["dirName"];
            const logPath = combinations[combo]["logPath"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => dirName: " + dirName + ", logPath: " + logPath, async() => {
                const actualResult = await logHelper.createLogDir(dirName, logPath);
                expect(actualResult).to.equal(expectedResult);
            });
        }

        it("create log dir with valid dirName and logPath", async () => {
            await testCreateAndRemoveLogDir(testProjectId, testProjectName);
        });

        it("create log dir with existing dirName and logPath", async () => {
            const dirName = await logHelper.getLogDir(testProjectId, testProjectName);
            const dirPath = path.resolve(process.cwd(), dirName);

            await logHelper.createLogDir(dirName, process.cwd());
            expect(fs.statSync(dirPath)).to.exist;

            const createReturn = await logHelper.createLogDir(dirName, process.cwd());
            expect(createReturn).to.equal(path.join(process.cwd(), dirName));

            try {
                fs.rmdirSync(dirPath);
                fs.statSync(dirPath);
            } catch (err) {
                expect(err.message).to.equal("ENOENT: no such file or directory, stat '" + dirPath + "'");
            }
        });
    });

    describe("combinational testing of removeLogDir function", () => {
        const testProjectId = "1234";
        const testProjectName = "abcd";

        const combinations: any = {
            "combo1": {
                "dirName": undefined,
                "logPath": undefined,
                "result": undefined,
            },
            "combo2": {
                "dirName": testProjectId + "-" + testProjectName,
                "logPath": undefined,
                "result": undefined
            },
            "combo3": {
                "dirName": undefined,
                "logPath": "xyz",
                "result": undefined
            }
        };

        beforeEach(async () => {
            process.chdir(process.env.CW_LOGS_DIR);
        });

        afterEach(() => {
            process.chdir(testWD);
        });

        for (const combo of Object.keys(combinations)) {
            const dirName = combinations[combo]["dirName"];
            const logPath = combinations[combo]["logPath"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => dirName: " + dirName + ", logPath: " + logPath, async() => {
                const actualResult = await logHelper.removeLogDir(dirName, logPath);
                expect(actualResult).to.equal(expectedResult);
            });
        }

        it("remove log dir with valid dirName and logPath", async () => {
            await testCreateAndRemoveLogDir(testProjectId, testProjectName);
        });

        it("remove log dir that does not exist", async () => {
            const dirName = await logHelper.getLogDir("undefined", "undefined");
            const removeReturn = await logHelper.removeLogDir(dirName, process.cwd());
            expect(removeReturn).to.be.undefined;
        });
    });

    describe("combinational testing of getLogFiles function", () => {
        const testProjectId = "1234";
        const testProjectName = "abcd";
        const logSuffixes = ["log1", "log2"];
        let logDirectory: string;
        let dirName: string;

        before("create a log directory with some fake log files", async () => {
            process.chdir(process.env.CW_LOGS_DIR);

            dirName = await logHelper.getLogDir(testProjectId, testProjectName);
            logDirectory = path.resolve(process.cwd(), dirName);

            await logHelper.createLogDir(dirName, process.cwd());
            expect(fs.statSync(logDirectory)).to.exist;

            for (const suffix of logSuffixes) {
                const file = suffix + logHelperModule.getlogExtension();
                const filePath = path.resolve(logDirectory, file);
                fs.writeFileSync(filePath, "some data");
            }
        });

        after("remove the log directory", async () => {
            dirName = await logHelper.getLogDir(testProjectId, testProjectName);
            logDirectory = path.resolve(process.cwd(), dirName);

            await logHelper.removeLogDir(dirName, process.cwd());
            try {
                fs.statSync(logDirectory);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }

            process.chdir(testWD);
        });

        const combinations: any = {
            "combo1": {
                "logDirectory": undefined,
                "logSuffixes": undefined,
                "result": undefined
            },
            "combo2": {
                "logDirectory": logDirectory,
                "logSuffixes": undefined,
                "result": undefined
            },
            "combo3": {
                "logDirectory": undefined,
                "logSuffixes": logSuffixes,
                "result": undefined
            }
        };

        for (const combo of Object.keys(combinations)) {
            const logDirectory = combinations[combo]["logDirectory"];
            const logSuffixes = combinations[combo]["logSuffixes"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => logDirectory: " + logDirectory + ", logSuffixes: " + logSuffixes, async() => {
                const actualResult = await logHelper.getLogFiles(logDirectory, logSuffixes);
                expect(actualResult).to.equal(expectedResult);
            });
        }


        it("getLogFiles with valid logDirectory and logSuffixes", async () => {
            const actualResult = await logHelper.getLogFiles(logDirectory, logSuffixes);
            expect(actualResult).to.exist;
            for (let index = 0; index < actualResult.length; index++) {
                const result = actualResult[index];
                const tokens = result.split("/");
                const filename = tokens[tokens.length - 1].split(logHelperModule.logExtension)[0];
                expect(logSuffixes.includes(filename));
            }
        });

        it("getLogFiles with invalid logDirectory and valid logSuffixes", async () => {
            const actualResult = await logHelper.getLogFiles("some dir", logSuffixes);
            expect(actualResult).to.exist;
            expect(actualResult).to.deep.equal([]);
        });
    });
}

/**
 * @function
 * @description Helper function to test creation and removal of log directory.
 *
 * @param projectID <Required | String> - The alpha-numeric id for the project.
 * @param projectName <Required | String> - The project name.
 *
 * @returns Promise<void>
 */
async function testCreateAndRemoveLogDir(projectID: string, projectName: string): Promise<void> {
    const dirName = await logHelper.getLogDir(projectID, projectName);
    const dirPath = path.resolve(process.cwd(), dirName);

    await logHelper.createLogDir(dirName, process.cwd());
    expect(fs.statSync(dirPath)).to.exist;

    await logHelper.removeLogDir(dirName, process.cwd());

    try {
        fs.statSync(dirPath);
    } catch (err) {
        expect(err.code).to.equal("ENOENT");
    }
}
