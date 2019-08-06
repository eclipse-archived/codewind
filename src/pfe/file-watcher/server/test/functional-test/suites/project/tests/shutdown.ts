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
import { shutdown, ProjectCreation } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";

import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";

import CreateTest from "./create";

export default class ShutdownTest {
    testName: string;

    constructor(testName: string) {
        this.testName = testName;
    }

    run(socket: SocketIO, projData: ProjectCreation, projectLang: string, runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(this.testName, () => {
            this.beforeAllHook(socket, projData);
            this.afterAllHook(socket);

            it(`shutdown turbine gracefully with ${projectLang} project`, async () => {
                const info: any = await shutdown();
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(202);

                const data = {
                    "status": "success"
                };
                const targetEvent = eventConfigs.events.filewatcherShutdown;
                let eventFound = false;
                let event: any;
                await new Promise((resolve) => {
                    const timer = setInterval(() => {
                        const events = socket.getAllEvents();
                        if (events && events.length >= 1) {
                            event =  events.filter((value) => {
                                // && _.isEqual(Object.keys(value.eventData), data)
                                if (value.eventName === targetEvent) {
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
                    expect(event.eventData).to.deep.equal(data);
                }
            }).timeout(timeoutConfigs.defaultTimeout);
        });
    }

    private beforeAllHook(socket: SocketIO, projData: ProjectCreation): void {
        before(("create a project"), async () => {
            const createTest = new CreateTest("create test");
            createTest.runCreateWithValidData(socket, projData);
        });
    }

    private afterAllHook(socket: SocketIO): void {
        after("clear socket events for create test", () => {
            socket.clearEvents();
        });
    }
}
