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
import { fail } from "assert";

import * as genericLib from "../../../lib/generic";
import * as utils from "../../../lib/utils";
import { SocketIO } from "../../../lib/socket-io";

import * as app_configs from "../../../configs/app.config";
import * as eventConfigs from "../../../configs/event.config";
import * as pfe_configs from "../../../configs/pfe.config";
import * as timeoutConfigs from "../../../configs/timeout.config";

export default class WorkspaceTest {
    testName: string;

    constructor(testName: string) {
        this.testName = testName;
    }

    run(socket: SocketIO, runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(this.testName, () => {
            const settingsPath = path.join(app_configs.codewindWorkspaceDir, ".config", "settings.json");
            const backupSettingsPath = path.join(app_configs.codewindWorkspaceDir, ".config", "settings_bk.json");
            const settingsContent = {
                registryAddress: "someregistryaddress",
                registryNamespace: "someregistrynamespace",
                watcherChunkTimeout: 50000
            };
            let backupSettingsContent: any = {};

            before("read the settings file content and save it", async () => {
                if (await fs.existsSync(settingsPath)) {
                    backupSettingsContent = JSON.parse(await fs.readFileSync(settingsPath, {encoding: "utf-8"}));
                    backupSettingsContent["watcherChunkTimeout"] = backupSettingsContent["watcherChunkTimeout"] || "";
                }
            });
            afterEach("delete backup settings file, revert back original file and load the current workspace settings", async () => {
                if (await fs.existsSync(backupSettingsPath)) {
                    backupSettingsContent = JSON.parse(await fs.readFileSync(backupSettingsPath, {encoding: "utf-8"}));
                    backupSettingsContent["watcherChunkTimeout"] = backupSettingsContent["watcherChunkTimeout"] || "";
                    await fs.renameSync(backupSettingsPath, settingsPath);
                    await fs.chownSync(settingsPath, 1001, 2004);
                    const info: any = await genericLib.readWorkspaceSettings();
                    expect(info);
                    expect(info.statusCode);
                    expect(info.statusCode).to.equal(200);
                }
            });

            this.runReadWorkspaceSettings(socket, settingsPath, settingsContent, backupSettingsPath);
            this.runImagePushRegistryStatus(socket);
            if (process.env.IN_K8) {
                this.runTestImagePushRegistry(settingsContent);
            }
        });
    }

    private runReadWorkspaceSettings(socket: SocketIO, settingsPath: string, settingsContent: any, backupSettingsPath: string): void {
        describe("readWorkspaceSettings function", () => {
            after("clear socket events for create test", () => {
                socket.clearEvents();
            });

            describe("read workspace settings without file", () => {
                before("create a backup for original settings file and remove the original file", async () => {
                    if (await fs.existsSync(settingsPath)) {
                        await fs.renameSync(settingsPath, backupSettingsPath);
                    }
                });

                it("read workspace settings without file", async () => {
                    const info: any = await genericLib.readWorkspaceSettings();
                    expect(info);
                    expect(info.statusCode);
                    expect(info.statusCode).to.equal(500);
                    expect(info.msg);
                    expect(info.msg).to.equal(`The workspace settings file was not found at location: ${settingsPath}`);
                });
            });

            describe("read workspace settings with valid contents in file", () => {
                before("create a backup for original settings file and create a fake settings file", async () => {
                    if (await fs.existsSync(settingsPath)) {
                        await fs.copyFileSync(settingsPath, backupSettingsPath);
                        await fs.writeFileSync(settingsPath, JSON.stringify(settingsContent));
                    } else {
                        await fs.writeFileSync(settingsPath, JSON.stringify(settingsContent));
                        await fs.chownSync(settingsPath, 1001, 2004);
                    }
                });

                it("read workspace settings with valid contents ", async () => {
                    const info: any = await genericLib.readWorkspaceSettings();
                    expect(info);
                    expect(info.statusCode);
                    expect(info.statusCode).to.equal(200);
                });
            });

            describe("read workspace settings with invalid deployment registry in file", () => {
                const badSettingsContent = _.cloneDeep(settingsContent);
                badSettingsContent.registryAddress = "x^72@!$&";
                badSettingsContent.registryNamespace = "x^72@!$&";

                before("create a backup for original settings file and create a fake settings file", async () => {
                    if (await fs.existsSync(settingsPath)) {
                        await fs.copyFileSync(settingsPath, backupSettingsPath);
                        await fs.writeFileSync(settingsPath, JSON.stringify(badSettingsContent));
                    } else {
                        await fs.writeFileSync(settingsPath, JSON.stringify(badSettingsContent));
                        await fs.chownSync(settingsPath, 1001, 2004);
                    }
                });

                it("read workspace settings with invalid deployment registry", async () => {
                    const info: any = await genericLib.readWorkspaceSettings();
                    const failureMsg = "Codewind detected an error with the Image Push Registry " + badSettingsContent.registryAddress + "/" + badSettingsContent.registryNamespace + ". Please ensure it is a valid Image Push Registry.";
                    const targetEvent = eventConfigs.events.imagePushRegistryStatus;
                    expect(info);
                    expect(info.statusCode);
                    expect(info.statusCode).to.equal(500);
                    expect(info.msg);
                    expect(info.msg).to.equal(failureMsg);
                    const event = await utils.waitForEvent(socket, targetEvent);
                    if (event) {
                        expect(event);
                        expect(event.eventName);
                        expect(event.eventName).to.equal(targetEvent);
                        expect(event.eventData);
                        expect(event.eventData).to.haveOwnProperty("imagePushRegistryTest");
                        expect(event.eventData).to.haveOwnProperty("msg");
                        expect(event.eventData["imagePushRegistryTest"]).to.equal(false);
                        expect(event.eventData["msg"]).to.equal(failureMsg);
                    } else {
                        fail(`read workspace settings test failed to listen for ${targetEvent}`);
                    }
                }).timeout(timeoutConfigs.deleteTestTimeout);
            });
        });
    }

    private runImagePushRegistryStatus(socket: SocketIO): void {
        describe("imagePushRegistryStatus function", () => {
            const deploymentRegistryRequest = {
                "projectID": "1234",
                "detailedImagePushRegistryStatus": "some status"
            };

            after("clear socket events for create test", () => {
                socket.clearEvents();
            });

            it("set deployment registry status with missing projectId", async () => {
                const request = _.cloneDeep(deploymentRegistryRequest);
                delete request.projectID;
                const info: any = await genericLib.imagePushRegistryStatus(request);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(400);
                expect(info.error);
                expect(info.error).to.haveOwnProperty("msg");
                expect(info.error["msg"]).to.equal("Missing request parameters projectID or detailedImagePushRegistryStatus for image push registry status");
            });

            it("set deployment registry status with missing status", async () => {
                const request = _.cloneDeep(deploymentRegistryRequest);
                delete request.detailedImagePushRegistryStatus;
                const info: any = await genericLib.imagePushRegistryStatus(request);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(400);
                expect(info.error);
                expect(info.error).to.haveOwnProperty("msg");
                expect(info.error["msg"]).to.equal("Missing request parameters projectID or detailedImagePushRegistryStatus for image push registry status");
            });

            it("set deployment registry status with valid data", async () => {
                const request = _.cloneDeep(deploymentRegistryRequest);
                const targetEvent = eventConfigs.events.imagePushRegistryStatus;
                const info: any = await genericLib.imagePushRegistryStatus(request);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(200);

                const event = await utils.waitForEvent(socket, targetEvent);
                if (event) {
                    expect(event);
                    expect(event.eventName);
                    expect(event.eventName).to.equal(targetEvent);
                    expect(event.eventData);
                    expect(event.eventData).to.haveOwnProperty("imagePushRegistryTest");
                    expect(event.eventData).to.haveOwnProperty("msg");
                    expect(event.eventData["imagePushRegistryTest"]).to.equal(false);
                    expect(event.eventData["msg"]).to.equal(request.detailedImagePushRegistryStatus);
                } else {
                    fail(`read workspace settings test failed to listen for ${targetEvent}`);
                }
            }).timeout(timeoutConfigs.deleteTestTimeout);

            it("check for an event from the registered listener", async () => {
                const events = await socket.getAllEvents();
                expect(events);
                expect(Array.isArray(events));
                expect(Object.keys(events[0])).to.deep.equal(["eventName", "eventData"]);
            });
        });
    }

    private runTestImagePushRegistry(settingsContent: any): void {
        describe("testImagePushRegistry function", () => {
            const invalidPullImage = "someimage";

            it("with invalid push registry", async () => {
                const info = await genericLib.testImagePushRegistry(settingsContent.registryAddress, settingsContent.registryNamespace);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(200);
                expect(info.imagePushRegistryTest);
                expect(info.imagePushRegistryTest).to.equal(false);
                expect(info.msg);
                expect(info.msg).to.equal(`Codewind was unable to push the hello-world image to the Image Push Registry ${settingsContent.registryAddress}/${settingsContent.registryNamespace}/hello-world. Please make sure it is a valid Image Push Registry with the appropriate permissions.`);
            }).timeout(timeoutConfigs.testImagePushRegistryTimeout);

            it("with invalid push registry and pull image", async () => {
                const info = await genericLib.testImagePushRegistry(settingsContent.registryAddress, settingsContent.registryNamespace, invalidPullImage);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(500);
                expect(info.imagePushRegistryTest);
                expect(info.imagePushRegistryTest).to.equal(false);
                expect(info.msg);
                expect(info.msg).to.equal(`Codewind was unable to pull the ${invalidPullImage} image during the Image Push Registry test.`);
            }).timeout(timeoutConfigs.testImagePushRegistryTimeout);

            it("with valid push registry and invalid pull image", async () => {
                const info = await genericLib.testImagePushRegistry(pfe_configs.imagePushRegistryAddress, pfe_configs.imagePushRegistryNamespace, invalidPullImage);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(500);
                expect(info.imagePushRegistryTest);
                expect(info.imagePushRegistryTest).to.equal(false);
                expect(info.msg);
                expect(info.msg).to.equal(`Codewind was unable to pull the ${invalidPullImage} image during the Image Push Registry test.`);
            }).timeout(timeoutConfigs.testImagePushRegistryTimeout);

            it("with valid push registry and default pull image", async () => {
                const info = await genericLib.testImagePushRegistry(pfe_configs.imagePushRegistryAddress, pfe_configs.imagePushRegistryNamespace);
                expect(info);
                expect(info.statusCode);
                expect(info.statusCode).to.equal(200);
                expect(info.imagePushRegistryTest);
                expect(info.imagePushRegistryTest).to.equal(true);
                expect(info.msg);
                expect(info.msg).to.equal(`Codewind projects on Kubernetes will build with the Image Push Registry: ${pfe_configs.imagePushRegistryAddress}/${pfe_configs.imagePushRegistryNamespace}`);
            }).timeout(timeoutConfigs.testImagePushRegistryTimeout);
        });
    }
}
