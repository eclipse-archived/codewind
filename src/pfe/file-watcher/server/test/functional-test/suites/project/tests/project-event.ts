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
import fs from "fs";

import * as projectsController from "../../../../../src/controllers/projectsController";
import { updateProjectForNewChange } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";
import * as utils from "../../../lib/utils";

import * as eventConfigs from "../../../configs/event.config";
import * as project_configs from "../../../configs/project.config";
import * as timeoutConfigs from "../../../configs/timeout.config";
import { fail } from "assert";

export function projectEventTest(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
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
            if (!process.env.TURBINE_PERFORMANCE_TEST) {
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
        }

        const types = ["MODIFY", "CREATE"];

        for (const type of types) {
            describe(`update file with type = ${type.toLowerCase()}`, () => {
                updateProject(type);
            });
        }

        function updateProject(type: string): void {
            let filesList = ["file1"];
            if (type.toLowerCase() === "modify") filesList = project_configs.filesToUpdate[projectTemplate] && project_configs.filesToUpdate[projectTemplate][projectLang] || [];
            for (const file of filesList) {
                it(`${type.toLowerCase()} file: ${file}`, async () => {
                    let dataFile, fileContent, chosenTimestamp, startTime;
                    if (process.env.TURBINE_PERFORMANCE_TEST) {
                        dataFile = path.resolve(__dirname, "..", "..", "..", "..", "performance-test", "data", process.env.TEST_TYPE, process.env.TURBINE_PERFORMANCE_TEST, "performance-data.json");
                        fileContent = JSON.parse(await fs.readFileSync(dataFile, "utf-8"));
                        chosenTimestamp = Object.keys(fileContent[projectTemplate][projectLang]).sort().pop();
                        startTime = Date.now();
                    }

                    const fileToChange = file;
                    const pathFileToChange = path.join(projData.location, fileToChange);

                    if (file.toLowerCase() === "dockerfile") {
                        const dockerFileContents = await fs.readFileSync(pathFileToChange).toString();
                        const contentSplits = dockerFileContents.split(/\r?\n/);
                        if (projectLang.toLowerCase() == "liberty") {
                            contentSplits.splice(contentSplits.indexOf("USER root") + 1, 0, "RUN mkdir -p /home/defaut/turbine-test");
                        } else {
                            contentSplits.splice(1, 0, "RUN mkdir -p /turbine-test");
                        }
                        await fs.writeFileSync(pathFileToChange, contentSplits.join("\n"), "utf-8");
                    } else {
                        await fs.appendFileSync(pathFileToChange, "\r\n", "utf-8");
                    }

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

                    const targetEvent = projData.projectType === "docker" && process.env.IN_K8 ? eventConfigs.events.statusChanged : eventConfigs.events.projectChanged;
                    const targetData = projData.projectType === "docker" && process.env.IN_K8 ? {
                        "projectID": projData.projectID,
                        "appStatus": "started"
                    } : {
                        "projectID": projData.projectID,
                        "status": "success"
                    };

                    const event = await utils.waitForEvent(socket, targetEvent, targetData);
                    if (event) {
                        expect(event);
                        expect(event.eventName);
                        expect(event.eventName).to.equal(targetEvent);
                        expect(event.eventData);
                        expect(event.eventData).to.haveOwnProperty("projectID");
                        expect(event.eventData.projectID).to.equal(targetData.projectID);
                        if (projData.projectType === "docker" && process.env.IN_K8) {
                            expect(event.eventData).to.haveOwnProperty("appStatus");
                            expect(event.eventData.appStatus).to.equal(targetData.appStatus);
                        } else {
                            expect(event.eventData).to.haveOwnProperty("status");
                            expect(event.eventData.status).to.equal(targetData.status);
                        }
                    } else {
                        fail(`failed to find ${targetEvent} for updating docker file`);
                    }

                    if (process.env.TURBINE_PERFORMANCE_TEST) {
                        const endTime = Date.now();
                        const totalTestTime = (endTime - startTime) / 1000;
                        fileContent[projectTemplate][projectLang][chosenTimestamp][`${type.toLowerCase()}-${file}`] = totalTestTime;
                        await fs.writeFileSync(dataFile, JSON.stringify(fileContent));
                    }
                }).timeout(timeoutConfigs.createTestTimeout);
            }
        }
    });
}
