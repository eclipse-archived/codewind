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
import * as logger from "../../../src/utils/logger";
import * as app_configs from "../../functional-test/configs/app.config";
import { existsAsync, mkdirAsync, copyAsync, rmdirAsync, unlinkAsync, readFileAsync } from "../../functional-test/lib/utils";


export function loggerTestModule(): void {

    const turbineLogPath = path.join(app_configs.codewindWorkspaceLogsDir, "Turbine.log");

    const projectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
    const originalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
    const testProjectMetadata = path.join(projectMetadataPath, "dummynodeproject.json");

    describe("combinational testing of logProjectInfo function", () => {

        before("create test directories", async () => {
            if (!(await existsAsync(projectMetadataPath))) {
                await mkdirAsync(projectMetadataPath);
                await copyAsync(originalProjectMetadata, testProjectMetadata);
            }

            process.env.HIDE_PFE_LOG = "n";
        });

        after("remove test directories", async () => {
            if ((await existsAsync(projectMetadataPath))) {
                await unlinkAsync(testProjectMetadata);
                await rmdirAsync(projectMetadataPath);
            }
            process.env.HIDE_PFE_LOG = "y";
        });

        const combinations: any = {
            "combo1": {
                "msg": "Random Info Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": "thisProjectIDWillNotBeUsed",
                "projectName": "someProject",
                "logContentsPrefix": "someProject",
                "result": true
            },
            "combo2": {
                "msg": "Random Info Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": "dummynodeproject",
                "projectName": undefined,
                "logContentsPrefix": "hino1",
                "result": true
            },
            "combo3": {
                "msg": "Random Info Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": "garbageProjectID",
                "projectName": undefined,
                "logContentsPrefix": "Turbine",
                "result": true
            },
            "combo4": {
                "msg": "Random Info Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": undefined,
                "projectName": undefined,
                "logContentsPrefix": "Turbine",
                "result": true
            }
        };

        for (const combo of Object.keys(combinations)) {

            const msg = combinations[combo]["msg"];
            const projectID = combinations[combo]["projectID"];
            const projectName = combinations[combo]["projectName"];
            const logContentsPrefix = combinations[combo]["logContentsPrefix"];
            const expectedResult = combinations[combo]["result"];

            const regex = new RegExp(logContentsPrefix + ".*INFO.*" + msg, "g");

            it(combo + " => msg: " + msg + ", projectID: " + projectID + ", projectName: " + projectName, async() => {
                logger.logProjectInfo(msg, projectID, projectName);
                let intervalCtr = 0;
                const retval = await new Promise((resolve) => {
                    const intervaltimer = setInterval(async () => {
                        // attempt to read the Turbine.log file 5 times as the tests have to wait for log4js to log to the file
                        const turbineLogContents = await readFileAsync(turbineLogPath);
                        intervalCtr++;
                        const isContentPresent = regex.test(turbineLogContents.toString());
                        if (isContentPresent) {
                            clearInterval(intervaltimer);
                            return resolve(isContentPresent);
                        }
                        if (intervalCtr == 5) {
                            clearInterval(intervaltimer);
                            return resolve(false);
                        }
                    }, 1000);
                });
                expect(retval).to.equal(expectedResult);
            }).timeout(10000);
        }
    });

    describe("combinational testing of logProjectError function", () => {

        before("create test directories", async () => {
            if (!(await existsAsync(projectMetadataPath))) {
                await mkdirAsync(projectMetadataPath);
                await copyAsync(originalProjectMetadata, testProjectMetadata);
            }

            process.env.HIDE_PFE_LOG = "n";
        });

        after("remove test directories", async () => {
            if ((await existsAsync(projectMetadataPath))) {
                await unlinkAsync(testProjectMetadata);
                await rmdirAsync(projectMetadataPath);
            }
            process.env.HIDE_PFE_LOG = "y";
        });

        const combinations: any = {
            "combo1": {
                "msg": "Random Error Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": "thisProjectIDWillNotBeUsed",
                "projectName": "someProject",
                "logContentsPrefix": "someProject",
                "result": true
            },
            "combo2": {
                "msg": "Random Error Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": "dummynodeproject",
                "projectName": undefined,
                "logContentsPrefix": "hino1",
                "result": true
            },
            "combo3": {
                "msg": "Random Error Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": "garbageProjectID",
                "projectName": undefined,
                "logContentsPrefix": "Turbine",
                "result": true
            },
            "combo4": {
                "msg": "Random Error Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": undefined,
                "projectName": undefined,
                "logContentsPrefix": "Turbine",
                "result": true
            }
        };

        for (const combo of Object.keys(combinations)) {

            const msg = combinations[combo]["msg"];
            const projectID = combinations[combo]["projectID"];
            const projectName = combinations[combo]["projectName"];
            const logContentsPrefix = combinations[combo]["logContentsPrefix"];
            const expectedResult = combinations[combo]["result"];

            const regex = new RegExp(logContentsPrefix + ".*ERROR.*" + msg, "g");

            it(combo + " => msg: " + msg + ", projectID: " + projectID + ", projectName: " + projectName, async() => {
                logger.logProjectError(msg, projectID, projectName);
                let intervalCtr = 0;
                const retval = await new Promise((resolve) => {
                    const intervaltimer = setInterval(async () => {
                        // attempt to read the Turbine.log file 5 times as the tests have to wait for log4js to log to the file
                        const turbineLogContents = await readFileAsync(turbineLogPath);
                        intervalCtr++;
                        const isContentPresent = regex.test(turbineLogContents.toString());
                        if (isContentPresent) {
                            clearInterval(intervaltimer);
                            return resolve(isContentPresent);
                        }
                        if (intervalCtr == 5) {
                            clearInterval(intervaltimer);
                            return resolve(false);
                        }
                    }, 1000);
                });
                expect(retval).to.equal(expectedResult);
            }).timeout(10000);
        }
    });

    describe("combinational testing of logProjectDebug function", () => {

        before("create test directories", async () => {
            if (!(await existsAsync(projectMetadataPath))) {
                await mkdirAsync(projectMetadataPath);
                await copyAsync(originalProjectMetadata, testProjectMetadata);
            }

            process.env.HIDE_PFE_LOG = "n";
            logger.setLoggingLevel("debug");
        });

        after("remove test directories", async () => {
            if ((await existsAsync(projectMetadataPath))) {
                await unlinkAsync(testProjectMetadata);
                await rmdirAsync(projectMetadataPath);
            }
            process.env.HIDE_PFE_LOG = "y";
        });

        const combinations: any = {
            "combo1": {
                "msg": "Random Debug Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": "dummynodeproject",
                "logContentsPrefix": "hino1",
                "result": true
            },
            "combo2": {
                "msg": "Random Debug Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": "garbageProjectID",
                "logContentsPrefix": "Turbine",
                "result": true
            },
            "combo3": {
                "msg": "Random Debug Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": undefined,
                "logContentsPrefix": "Turbine",
                "result": true
            }
        };

        for (const combo of Object.keys(combinations)) {

            const msg = combinations[combo]["msg"];
            const projectID = combinations[combo]["projectID"];
            const logContentsPrefix = combinations[combo]["logContentsPrefix"];
            const expectedResult = combinations[combo]["result"];

            const regex = new RegExp(logContentsPrefix + ".*DEBUG.*" + msg, "g");

            it(combo + " => msg: " + msg + ", projectID: " + projectID, async() => {
                logger.logProjectDebug(msg, projectID);
                let intervalCtr = 0;
                const retval = await new Promise((resolve) => {
                    const intervaltimer = setInterval(async () => {
                        // attempt to read the Turbine.log file 5 times as the tests have to wait for log4js to log to the file
                        const turbineLogContents = await readFileAsync(turbineLogPath);
                        intervalCtr++;
                        const isContentPresent = regex.test(turbineLogContents.toString());
                        if (isContentPresent) {
                            clearInterval(intervaltimer);
                            return resolve(isContentPresent);
                        }
                        if (intervalCtr == 5) {
                            clearInterval(intervaltimer);
                            return resolve(false);
                        }
                    }, 1000);
                });
                expect(retval).to.equal(expectedResult);
            }).timeout(10000);
        }
    });

    describe("combinational testing of logProjectTrace function", () => {

        before("create test directories", async () => {
            if (!(await existsAsync(projectMetadataPath))) {
                await mkdirAsync(projectMetadataPath);
                await copyAsync(originalProjectMetadata, testProjectMetadata);
            }

            process.env.HIDE_PFE_LOG = "n";
            logger.setLoggingLevel("trace");
        });

        after("remove test directories", async () => {
            if ((await existsAsync(projectMetadataPath))) {
                await unlinkAsync(testProjectMetadata);
                await rmdirAsync(projectMetadataPath);
            }
            process.env.HIDE_PFE_LOG = "y";
        });

        const combinations: any = {
            "combo1": {
                "msg": "Random Trace Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": "dummynodeproject",
                "logContentsPrefix": "hino1",
                "result": true
            },
            "combo2": {
                "msg": "Random Trace Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": "garbageProjectID",
                "logContentsPrefix": "Turbine",
                "result": true
            },
            "combo3": {
                "msg": "Random Trace Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": undefined,
                "logContentsPrefix": "Turbine",
                "result": true
            }
        };

        for (const combo of Object.keys(combinations)) {

            const msg = combinations[combo]["msg"];
            const projectID = combinations[combo]["projectID"];
            const logContentsPrefix = combinations[combo]["logContentsPrefix"];
            const expectedResult = combinations[combo]["result"];

            const regex = new RegExp(logContentsPrefix + ".*TRACE.*" + msg, "g");

            it(combo + " => msg: " + msg + ", projectID: " + projectID, async() => {
                logger.logProjectTrace(msg, projectID);
                let intervalCtr = 0;
                const retval = await new Promise((resolve) => {
                    const intervaltimer = setInterval(async () => {
                        // attempt to read the Turbine.log file 5 times as the tests have to wait for log4js to log to the file
                        const turbineLogContents = await readFileAsync(turbineLogPath);
                        intervalCtr++;
                        const isContentPresent = regex.test(turbineLogContents.toString());
                        if (isContentPresent) {
                            clearInterval(intervaltimer);
                            return resolve(isContentPresent);
                        }
                        if (intervalCtr == 5) {
                            clearInterval(intervaltimer);
                            return resolve(false);
                        }
                    }, 1000);
                });
                expect(retval).to.equal(expectedResult);
            }).timeout(10000);
        }
    });

    describe("testing of Turbine Log functions", () => {

        before("set env variable", async () => {
            process.env.HIDE_PFE_LOG = "n";
        });

        after("reset env variable", async () => {
            process.env.HIDE_PFE_LOG = "y";
        });

        const combinations: any = {
            "combo1": {
                "msg": "Random INFO Msg: " + Math.floor(Math.random() * Math.floor(1000)),
                "level": "info",
                "logContentsPrefix2": "INFO",
                "result": true
            },
            "combo2": {
                "msg": "Random ERROR Msg: " + Math.floor(Math.random() * Math.floor(1000)),
                "level": "error",
                "logContentsPrefix2": "ERROR",
                "result": true
            },
            "combo3": {
                "msg": "Random DEBUG Msg: " + Math.floor(Math.random() * Math.floor(1000)),
                "level": "debug",
                "logContentsPrefix2": "DEBUG",
                "result": true
            },
            "combo4": {
                "msg": "Random TRACE Msg: " + Math.floor(Math.random() * Math.floor(1000)),
                "level": "trace",
                "logContentsPrefix2": "TRACE",
                "result": true
            }
        };

        for (const combo of Object.keys(combinations)) {

            const msg = combinations[combo]["msg"];
            const level = combinations[combo]["level"];
            const logContentsPrefix1 = "Turbine";
            const logContentsPrefix2 = combinations[combo]["logContentsPrefix2"];
            const expectedResult = combinations[combo]["result"];

            logger.setLoggingLevel(level);
            const regex = new RegExp(logContentsPrefix1 + ".*" + logContentsPrefix2 + ".*" + msg, "g");

            it(combo + " => msg: " + msg + ", level: " + level, async() => {
                switch (combo) {
                    case "combo1": {
                        logger.logInfo(msg);
                        break;
                    }
                    case "combo2": {
                        logger.logError(msg);
                        break;
                    }
                    case "combo3": {
                        logger.logDebug(msg);
                        break;
                    }
                    case "combo4": {
                        logger.logTrace(msg);
                        break;
                    }
                }
                let intervalCtr = 0;
                const retval = await new Promise((resolve) => {
                    const intervaltimer = setInterval(async () => {
                        // attempt to read the Turbine.log file 5 times as the tests have to wait for log4js to log to the file
                        const turbineLogContents = await readFileAsync(turbineLogPath);
                        intervalCtr++;
                        const isContentPresent = regex.test(turbineLogContents.toString());
                        if (isContentPresent) {
                            clearInterval(intervaltimer);
                            return resolve(isContentPresent);
                        }
                        if (intervalCtr == 5) {
                            clearInterval(intervaltimer);
                            return resolve(false);
                        }
                    }, 1000);
                });
                expect(retval).to.equal(expectedResult);
            }).timeout(10000);
        }
    });

    describe("combinational testing of assert function", () => {

        before("create test directories", async () => {
            if (!(await existsAsync(projectMetadataPath))) {
                await mkdirAsync(projectMetadataPath);
                await copyAsync(originalProjectMetadata, testProjectMetadata);
            }

            process.env.HIDE_PFE_LOG = "n";
            logger.setLoggingLevel("info");
        });

        after("remove test directories", async () => {
            if ((await existsAsync(projectMetadataPath))) {
                await unlinkAsync(testProjectMetadata);
                await rmdirAsync(projectMetadataPath);
            }
            process.env.HIDE_PFE_LOG = "y";
        });

        const combinations: any = {
            "combo1": {
                "msg": "Random Assert Message: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": "dummynodeproject",
                "logContentsPrefix": "hino1",
                "result": true
            },
            "combo2": {
                "msg": "Random Assert Msg: " + Math.floor(Math.random() * Math.floor(1000)),
                "projectID": undefined,
                "logContentsPrefix": "Turbine",
                "result": true
            }
        };

        for (const combo of Object.keys(combinations)) {

            const msg = combinations[combo]["msg"];
            const projectID = combinations[combo]["projectID"];
            const logContentsPrefix = combinations[combo]["logContentsPrefix"];
            const expectedResult = combinations[combo]["result"];

            const regex = new RegExp(logContentsPrefix + ".*ERROR.*" + msg, "g");

            it(combo + " => msg: " + msg + ", projectID: " + projectID, async() => {
                if (combo == "combo1") {
                    logger.projectAssert(projectID, false, msg);
                } else {
                    logger.assert(false, msg);
                }
                let intervalCtr = 0;
                const retval = await new Promise((resolve) => {
                    const intervaltimer = setInterval(async () => {
                        // attempt to read the Turbine.log file 5 times as the tests have to wait for log4js to log to the file
                        const turbineLogContents = await readFileAsync(turbineLogPath);
                        intervalCtr++;
                        const isContentPresent = regex.test(turbineLogContents.toString());
                        if (isContentPresent) {
                            clearInterval(intervaltimer);
                            return resolve(isContentPresent);
                        }
                        if (intervalCtr == 5) {
                            clearInterval(intervaltimer);
                            return resolve(false);
                        }
                    }, 1000);
                });
                expect(retval).to.equal(expectedResult);
            }).timeout(10000);
        }
    });

    describe("combinational testing of setLoggingLevel function", () => {

        before("set env variable", async () => {
            process.env.HIDE_PFE_LOG = "n";
        });

        after("reset env variable", async () => {
            process.env.HIDE_PFE_LOG = "y";
        });

        const combinations: any = {
            "combo1": {
                "msg": "The current log level is",
                "level": "info",
                "logContentsPrefix2": "INFO",
                "result": true
            },
            "combo2": {
                "msg": "is not a valid value, the following log levels are available",
                "level": "wronglevel",
                "projectID": undefined,
                "logContentsPrefix2": "ERROR",
                "result": true
            }
        };

        for (const combo of Object.keys(combinations)) {

            const msg = combinations[combo]["msg"];
            const level = combinations[combo]["level"];
            const logContentsPrefix1 = "Turbine";
            const logContentsPrefix2 = combinations[combo]["logContentsPrefix2"];
            const expectedResult = combinations[combo]["result"];

            const regex = new RegExp(logContentsPrefix1 + ".*" + logContentsPrefix2 + ".*" + msg, "g");

            it(combo + " => msg: " + msg + ", level: " + level, async() => {
                try {
                    await logger.setLoggingLevel(level);
                } catch (err) {}
                const turbineLogContent = await getTurbineLogContent(turbineLogPath, regex);
                expect(turbineLogContent).to.equal(expectedResult);
            }).timeout(10000);
        }
    });
}

async function getTurbineLogContent(logPath: string, regex: RegExp): Promise<any> {
    let intervalCtr = 0;
    return new Promise((resolve) => {
        const intervaltimer = setInterval(async () => {
            // attempt to read the Turbine.log file 5 times as the tests have to wait for log4js to log to the file
            const turbineLogContents = await readFileAsync(logPath);
            intervalCtr++;
            const isContentPresent = regex.test(turbineLogContents.toString());
            if (isContentPresent) {
                clearInterval(intervaltimer);
                return resolve(isContentPresent);
            }
            if (intervalCtr == 5) {
                clearInterval(intervaltimer);
                return resolve(false);
            }
        }, 1000);
    });
}
