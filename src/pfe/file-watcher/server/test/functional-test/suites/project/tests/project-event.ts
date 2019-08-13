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
import path from "path";

import { ProjectCreation, updateProjectForNewChange } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";

import * as eventConfigs from "../../../configs/event.config";
import * as project_configs from "../../../configs/project.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { fail } from "assert";

export function projectEventTest(socket: SocketIO, projData: ProjectCreation, projectLang: string): void {
    describe("updateProjectForNewChange function", () => {
        afterEach("clear socket events", () => {
            socket.clearEvents();
        });

        const chunk = Math.random() * 1000;
        const data: any = {
            "projectID": projData.projectID,
            "timestamp": Date.now(),
            "chunk": chunk,
            "chunk_total": chunk + Math.random() * 100,
            "eventArray": []
        };

        const requiredKeys = ["projectID", "timestamp", "chunk", "chunk_total", "eventArray"];
        for (const key of requiredKeys) {
            it(`call updateProjectForNewChange without required key: ${key}`, async() => {
                const testData = _.cloneDeep(data);
                delete testData[key];
                const info: any = await updateProjectForNewChange(testData.projectID, testData.timestamp, testData.chunk, testData.chunk_total, testData.eventArray);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(400);
                expect(info.error);
                expect(info.error).to.haveOwnProperty("msg");
                expect(info.error.msg).to.equal("Bad request. projectID, timestamp, chunk, chunk_total and eventArray are required.");
            });
        }

        const types = ["MODIFY", "CREATE"];

        for (const type of types) {
            describe(`update file with type = ${type.toLowerCase()}`, () => {
                updateProject(type);
            });
        }

        function updateProject(type: string): void {
            let filesList = ["file1", "file2", "file3"];
            if (type.toLowerCase() === "modify") filesList = project_configs.filesToUpdate[projectLang];
            for (const file of filesList) {
                it(`${type.toLowerCase()} file: ${file}`, async () => {
                    const fileToChange = file;
                    const pathFileToChange = path.join(projData.location, fileToChange);

                    const testData = _.cloneDeep(data);
                    const events = {
                        path: pathFileToChange,
                        timestamp: Date.now(),
                        type: type,
                        directory: false
                    };
                    testData.eventArray.push(events);

                    const info: any = await updateProjectForNewChange(testData.projectID, testData.timestamp, testData.chunk, testData.chunk_total, testData.eventArray);
                    expect(info);
                    expect(info.statusCode);
                    expect(info.statusCode).to.equal(202);

                    const targetEvent = eventConfigs.events.statusChanged;
                    const targetData = {
                        "projectID": projData.projectID,
                        "appStatus": "started"
                    };
                    let eventFound = false;
                    let event: any;
                    await new Promise((resolve) => {
                        const timer = setInterval(() => {
                            const events = socket.getAllEvents();
                            if (events && events.length >= 1) {
                                event =  events.filter((value) => {
                                    if (value.eventName === targetEvent && _.isMatch(value.eventData, targetData)) {
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
                        expect(event.eventData).to.haveOwnProperty("projectID");
                        expect(event.eventData.projectID).to.equal(targetData.projectID);
                        expect(event.eventData).to.haveOwnProperty("appStatus");
                        expect(event.eventData.appStatus).to.equal(targetData.appStatus);
                    } else {
                        fail(`failed to find ${targetEvent} for updating docker file`);
                    }
                }).timeout(timeoutConfigs.defaultTimeout);
            }
        }
    });
}
