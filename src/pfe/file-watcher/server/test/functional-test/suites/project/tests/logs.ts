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
import mocha from "mocha";
import { expect } from "chai";
import * as _ from "lodash";

import { getProjectLogs, checkNewLogFile, ProjectCreation } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";

import * as log_configs from "../../../configs/log.config";
import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { fail } from "assert";

export function logsTest(socket: SocketIO, projData: ProjectCreation): void {
    describe("getProjectLogs function", () => {
        it("get project logs with missing id", async () => {
            const info: any = await getProjectLogs(undefined);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(400);
            expect(info.error);
            expect(info.error).to.haveOwnProperty("msg");
            expect(info.error.msg).to.equal("Bad request");
        });

        it("get project logs with invalid id", async () => {
            const badProjectId = "1234someid";
            const info: any = await getProjectLogs(badProjectId);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(404);
            expect(info.error);
            expect(info.error).to.haveOwnProperty("msg");
            expect(info.error.msg).to.equal(`Project does not exist ${badProjectId}`);
        });

        it("get project logs with valid id", async () => {
            const info: any = await getProjectLogs(projData.projectID);
            expect(info);
            expect(info.statusCode);
            expect(info.statusCode).to.equal(200);
            expect(info.logs);
            expect(info.logs).to.haveOwnProperty("build");
            expect(info.logs.build).to.haveOwnProperty("origin");
            expect(info.logs.build).to.haveOwnProperty("files");
            expect(info.logs.build.files[0].indexOf(projData.projectID) > -1);
            expect(info.logs).to.haveOwnProperty("app");
            expect(info.logs.app).to.haveOwnProperty("origin");
            expect(info.logs.app).to.haveOwnProperty("files");
            expect(info.logs.app.files[0].indexOf(projData.projectID) > -1);

            if (log_configs.logFileMappings[projData.projectType]) {
                const actualBuildLogFiles = log_configs.logFileMappings[projData.projectType].build;
                const actualAppLogFiles = log_configs.logFileMappings[projData.projectType].app;

                const expectedBuildLogFiles = info.logs.build.files;
                for (const logFile of expectedBuildLogFiles) {
                    const tokens = logFile.split("/");
                    const fileName = tokens[tokens.length - 1];
                    expect(_.includes(actualBuildLogFiles, fileName));
                }

                const expectedAppLogFiles = info.logs.app.files;
                for (const logFile of expectedAppLogFiles) {
                    const tokens = logFile.split("/");
                    const fileName = tokens[tokens.length - 1];
                    expect(_.includes(actualAppLogFiles, fileName));
                }
            }
        });
    });

    describe("checkNewLogFile function", () => {
        const combinations: any = {
            "combo1": {
                "projectID": undefined,
                "type": "build",
            },
            "combo2": {
                "projectID": projData.projectID,
                "type": undefined,
            },
            "combo3": {
                "projectID": projData.projectID,
                "type": "sometype",
            }
        };

        for (const combo of Object.keys(combinations)) {
            const projectID = combinations[combo]["projectID"];
            const type = combinations[combo]["type"];
            it(`${combo} => projectID: ${projectID}, type: ${type}`, async() => {
                const info: any = await checkNewLogFile(projectID, type);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(400);
                expect(info.error);
                expect(info.error).to.haveOwnProperty("msg");
                expect(info.error.msg).to.equal("Bad request");
            });
        }

        for (const logType of log_configs.logTypes) {
            it(`checking for new ${logType} log file`, async () => {
                const info: any = await checkNewLogFile(projData.projectID, logType);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(200);
                expect(info.logs);
                expect(info.logs).to.haveOwnProperty("projectID");
                expect(info.logs.projectID).to.equal(projData.projectID);
                expect(info.logs).to.haveOwnProperty("type");
                expect(info.logs.type).to.equal(logType);
                expect(info.logs).to.haveOwnProperty(logType);
                expect(info.logs[logType]);
                expect(info.logs[logType]).to.haveOwnProperty("origin");
                expect(info.logs[logType]).to.haveOwnProperty("files");
                expect(info.logs[logType].files[0].indexOf(projData.projectID) > -1);

                if (log_configs.logFileMappings[projData.projectType]) {
                    const actualFiles = log_configs.logFileMappings[projData.projectType][logType];
                    const expectedFiles = info.logs[logType].files;
                    for (const logFile of expectedFiles) {
                        const tokens = logFile.split("/");
                        const fileName = tokens[tokens.length - 1];
                        expect(_.includes(actualFiles, fileName));
                    }
                }

                const targetEvent = eventConfigs.events.logsListChanged;
                const returnData = info.logs;
                let eventFound = false;
                let event: any;
                await new Promise((resolve) => {
                    const timer = setInterval(() => {
                        const events = socket.getAllEvents();
                        if (events && events.length >= 1) {
                            event =  events.filter((value) => {
                                if (value.eventName === targetEvent && _.isMatch(value.eventData, returnData)) {
                                    return value;
                                }
                            })[0];
                            if (event) {
                                eventFound = true;
                                clearInterval(timer);
                                return resolve();
                            }
                        }
                    }, timeoutConfigs.defaultInterval);
                });

                if (eventFound && event) {
                    expect(event);
                    expect(event.eventName);
                    expect(event.eventName).to.equal(targetEvent);
                    expect(event.eventData);
                    expect(event.eventData).to.equal(returnData);
                } else {
                    fail(`failed to find ${targetEvent} for ${logType} log`);
                }
            }).timeout(timeoutConfigs.defaultTimeout);
        }
    });
}
