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
import * as projectsController from "../../../../../src/controllers/projectsController";
import { shutdown } from "../../../lib/project";
import { SocketIO } from "../../../lib/socket-io";
import * as utils from "../../../lib/utils";

import * as eventConfigs from "../../../configs/event.config";
import * as timeoutConfigs from "../../../configs/timeout.config";

import CreateTest from "./create";

export default class ShutdownTest {
    testName: string;

    constructor(testName: string) {
        this.testName = testName;
    }

    run(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string, runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(this.testName, () => {
            this.beforeAllHook(socket, projData, projectTemplate, projectLang);
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
                const event = await utils.waitForEvent(socket, targetEvent);

                if (event) {
                    expect(event);
                    expect(event.eventName);
                    expect(event.eventName).to.equal(targetEvent);
                    expect(event.eventData);
                    expect(event.eventData).to.deep.equal(data);
                }
            }).timeout(timeoutConfigs.defaultTimeout);
        });
    }

    private beforeAllHook(socket: SocketIO, projData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string): void {
        before(("create a project"), async () => {
            const createTest = new CreateTest("create test");
            createTest.runCreateWithValidData(socket, projData, projectTemplate, projectLang);
        });
    }

    private afterAllHook(socket: SocketIO): void {
        after("clear socket events for create test", () => {
            socket.clearEvents();
        });
    }
}
