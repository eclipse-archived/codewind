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
import * as _ from "lodash";
import path from "path";
import fs from "fs";

import * as genericLib from "../lib/generic";
import * as eventConfigs from "../configs/event.config";
import * as timeoutConfigs from "../configs/timeout.config";
import * as app_configs from "../configs/app.config";
import { SocketIO } from "../lib/socket-io";
import { fail } from "assert";

export function workspaceSettingsTestSuite(socket: SocketIO): void {
    describe("readWorkspaceSettings function", () => {
        const settingsPath = path.join(app_configs.codewindWorkspaceDir, ".config", "settings.json");
        const backup_settingsPath = path.join(app_configs.codewindWorkspaceDir, ".config", "settings_bk.json");
        const settingsContent = {
            deploymentRegistry: "someregistry",
            watcherChunkTimeout: 50000
        };

        afterEach("delete backup settings file, revert back original file and load the current workspace settings", async () => {
            if (await fs.existsSync(backup_settingsPath)) {
                await fs.renameSync(backup_settingsPath, settingsPath);
                await fs.chownSync(settingsPath, 1001, 2004);
                await genericLib.readWorkspaceSettings();
            }
        });

        describe("read workspace settings without file", () => {
            before("create a backup for original settings file and remove the original file", async () => {
                if (await fs.existsSync(settingsPath)) {
                    await fs.renameSync(settingsPath, backup_settingsPath);
                }
            });

            it("read workspace settings without file", async () => {
                const info = await genericLib.readWorkspaceSettings();
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(500);
                expect(info.workspaceSettings);
                expect(info.workspaceSettings["msg"]);
                expect(info.workspaceSettings.msg).to.equal(`The workspace settings file was not found at location: ${settingsPath}`);
            });
        });

        describe("read workspace settings with valid contents in file", () => {
            before("create a backup for original settings file and create a fake settings file", async () => {
                if (await fs.existsSync(settingsPath)) {
                    await fs.copyFileSync(settingsPath, backup_settingsPath);
                    await fs.writeFileSync(settingsPath, JSON.stringify(settingsContent));
                } else {
                    await fs.writeFileSync(settingsPath, JSON.stringify(settingsContent));
                    await fs.chownSync(settingsPath, 1001, 2004);
                }
            });

            it("read workspace settings with valid contents ", async () => {
                const info = await genericLib.readWorkspaceSettings();
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(200);
                expect(info.workspaceSettings);
                expect(info.workspaceSettings).to.deep.equal(settingsContent);
                expect(Object.keys(info.workspaceSettings)).to.deep.equal(Object.keys(settingsContent));
                expect(info.workspaceSettings.deploymentRegistry).to.equal(settingsContent.deploymentRegistry);
                expect(info.workspaceSettings.watcherChunkTimeout).to.equal(settingsContent.watcherChunkTimeout);
                console.log("Done test...");
            });
        });

        describe("read workspace settings with invalid deployment registry in file", () => {
            const badSettingsContent = _.cloneDeep(settingsContent);
            badSettingsContent.deploymentRegistry = "x^72@!$&";

            before("create a backup for original settings file and create a fake settings file", async () => {
                if (await fs.existsSync(settingsPath)) {
                    await fs.copyFileSync(settingsPath, backup_settingsPath);
                    await fs.writeFileSync(settingsPath, JSON.stringify(badSettingsContent));
                } else {
                    await fs.writeFileSync(settingsPath, JSON.stringify(badSettingsContent));
                    await fs.chownSync(settingsPath, 1001, 2004);
                }
            });

            it("read workspace settings with invalid deployment registry", async () => {
                const info = await genericLib.readWorkspaceSettings();
                const failureMsg = "Codewind detected an error with the Deployment Registry x^72@!$&. Please ensure it is a valid Deployment Registry.";
                const targetEvent = eventConfigs.events.deploymentRegistryStatus;
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(200);
                expect(info.workspaceSettings);
                expect(info.workspaceSettings["msg"]);
                expect(info.workspaceSettings.msg).to.equal(failureMsg);
                let eventFound = false;
                let event: any;
                await new Promise((resolve) => {
                    const timer = setInterval(() => {
                        const events = socket.getAllEvents();
                        if (events && events.length >= 1) {
                            event =  events.filter((value) => {
                                if (value.eventName === targetEvent) return value;
                            })[0];
                            if (event) {
                                eventFound = true;
                                clearInterval(timer);
                                return resolve();
                            }
                        }
                    }, timeoutConfigs.deploymentRegistryStatusInterval);
                });

                if (eventFound && event) {
                    expect(event);
                    expect(event.eventName);
                    expect(event.eventName).to.equal(targetEvent);
                    expect(event.eventData);
                    expect(event.eventData).to.haveOwnProperty("deploymentRegistryTest");
                    expect(event.eventData).to.haveOwnProperty("msg");
                    expect(event.eventData["deploymentRegistryTest"]).to.equal(false);
                    expect(event.eventData["msg"]).to.equal(failureMsg);
                } else {
                    fail(`read workspace settings test failed to listen for ${targetEvent}`);
                }
            }).timeout(timeoutConfigs.deleteTestTimeout);
        });
    });
}
