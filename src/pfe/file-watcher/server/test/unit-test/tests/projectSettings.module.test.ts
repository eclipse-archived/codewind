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

import * as projectSettings from "../../../src/projects/projectSpecifications";
import * as socket from "../../../src/utils/socket";
import * as app_configs from "../../functional-test/configs/app.config";
import { existsAsync, mkdirAsync, copyAsync, rmdirAsync, unlinkAsync } from "../../functional-test/lib/utils";


export function projectSettingsTestModule(): void {

    let contextRootStatus = "";
    let healthCheckStatus = "";
    let mavenProfilesStatus = "";
    let mavenPropertiesStatus = "";
    let ignoredPathsStatus = "";
    let internalDebugPortStatus = "";
    let internalPortStatus = "";
    let projectSettingsStatus = "";
    let statusPingTimeoutValue = "";
    let internalPortValue = "";

    socket.registerListener({
        name: "codewindunittest",
        handleEvent: (event, data) => {
            if (event === "projectSettingsChanged") {
                if (data.contextRoot) {
                    contextRootStatus = data.status;
                } else if (data.healthCheck) {
                    healthCheckStatus = data.status;
                } else if (data.mavenProfiles || (data.error && data.error.includes("mavenProfiles"))) {
                    mavenProfilesStatus = data.status;
                } else if (data.mavenProperties || (data.error && data.error.includes("mavenProperties"))) {
                    mavenPropertiesStatus = data.status;
                } else if (data.ignoredPaths || (data.error && data.error.includes("ignoredPaths"))) {
                    ignoredPathsStatus = data.status;
                } else if (data.ports) {
                    if (data.ports.internalDebugPort) {
                        internalDebugPortStatus = data.status;
                    }
                    if (data.ports.internalPort) {
                        internalPortValue = data.ports.internalPort;
                        internalPortStatus = data.status;
                    }
                } else if (data.statusPingTimeout) {
                    statusPingTimeoutValue = data.statusPingTimeout;
                } else {
                    projectSettingsStatus = data.status;
                }
            }
        }
    });

    describe("combinational testing of internalDebugPort function", () => {

        const nodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const nodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const nodeTestProjectMetadata = path.join(nodeProjectMetadataPath, "dummynodeproject.json");

        const swiftProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyswiftproject");
        const swiftOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyswiftproject.json");
        const swiftTestProjectMetadata = path.join(swiftProjectMetadataPath, "dummyswiftproject.json");

        before("create test directories", async () => {
            if (!(await existsAsync(nodeProjectMetadataPath))) {
                await mkdirAsync(nodeProjectMetadataPath);
                await copyAsync(nodeOriginalProjectMetadata, nodeTestProjectMetadata);
            }

            if (!(await existsAsync(swiftProjectMetadataPath))) {
                await mkdirAsync(swiftProjectMetadataPath);
                await copyAsync(swiftOriginalProjectMetadata, swiftTestProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(nodeProjectMetadataPath))) {
                await unlinkAsync(nodeTestProjectMetadata);
                await rmdirAsync(nodeProjectMetadataPath);
            }

            if ((await existsAsync(swiftProjectMetadataPath))) {
                await unlinkAsync(swiftTestProjectMetadata);
                await rmdirAsync(swiftProjectMetadataPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "internalDebugPortSettings": {
                    "internalDebugPort": "1234"
                },
                "result": "failed"
            },
            "combo2": {
                "internalDebugPortSettings": {
                    "internalDebugPort": "1234"
                },
                "result": "success"
            },
            "combo3": {
                "internalDebugPortSettings": {
                    "internalDebugPort": ""
                },
                "result": "success"
            }
        };

        for (const combo of Object.keys(combinations)) {
            const internalDebugPortSettings = combinations[combo]["internalDebugPortSettings"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => internalDebugPortSettings: " + JSON.stringify(internalDebugPortSettings), async () => {
                let projectID: string = "dummynodeproject";

                if (combo == "combo1") {
                    projectID = "dummyswiftproject";
                }

                await projectSettings.projectSpecificationHandler(projectID, internalDebugPortSettings);
                expect(internalDebugPortStatus).to.equal(expectedResult);
            });
        }
    });

    describe("combinational testing of internalPort function", () => {

        const nodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const nodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const nodeTestProjectMetadata = path.join(nodeProjectMetadataPath, "dummynodeproject.json");

        before("create test directories", async () => {
            if (!(await existsAsync(nodeProjectMetadataPath))) {
                await mkdirAsync(nodeProjectMetadataPath);
                await copyAsync(nodeOriginalProjectMetadata, nodeTestProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(nodeProjectMetadataPath))) {
                await unlinkAsync(nodeTestProjectMetadata);
                await rmdirAsync(nodeProjectMetadataPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "internalPortSettings": {
                    "internalPort": ""
                },
                "expectedPortValue": "",
                "result": ""
            },
            "combo2": {
                "internalPortSettings": {
                    "internalPort": "1234"
                },
                "expectedPortValue": "1234",
                "result": "success"
            }
        };

        for (const combo of Object.keys(combinations)) {
            const internalPortSettings = combinations[combo]["internalPortSettings"];
            const expectedResult = combinations[combo]["result"];
            const expectedPortValue = combinations[combo]["expectedPortValue"];

            it(combo + " => internalPortSettings: " + JSON.stringify(internalPortSettings), async () => {
                const projectID: string = "dummynodeproject";

                await projectSettings.projectSpecificationHandler(projectID, internalPortSettings);
                expect(internalPortStatus).to.equal(expectedResult);
                expect(internalPortValue).to.equal(expectedPortValue);
            });
        }
    });

    describe("combinational testing of changeContextRoot function", () => {

        const projectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const originalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const testProjectMetadata = path.join(projectMetadataPath, "dummynodeproject.json");

        before("create test directories", async () => {
            if (!(await existsAsync(projectMetadataPath))) {
                await mkdirAsync(projectMetadataPath);
                await copyAsync(originalProjectMetadata, testProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(projectMetadataPath))) {
                await unlinkAsync(testProjectMetadata);
                await rmdirAsync(projectMetadataPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "contextSettings": {
                    "contextRoot": "hi"
                },
                "result": "success"
            },
            "combo2": {
                "contextSettings": {
                    "contextRoot": "<script>alert(\"xss\");</script>"
                },
                "result": "failed"
            },
            "combo3": {
                "contextSettings": {
                    "contextRoot": ""
                },
                "result": "success"
            }
        };

        for (const combo of Object.keys(combinations)) {
            const contextSettings = combinations[combo]["contextSettings"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => contextSettings: " + JSON.stringify(contextSettings), async () => {
                const projectID: string = "dummynodeproject";

                await projectSettings.projectSpecificationHandler(projectID, contextSettings);
                expect(contextRootStatus).to.equal(expectedResult);
            });
        }
    });

    describe("combinational testing of changeHealthCheck function", () => {

        const projectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const originalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const testProjectMetadata = path.join(projectMetadataPath, "dummynodeproject.json");

        before("create test directories", async () => {
            if (!(await existsAsync(projectMetadataPath))) {
                await mkdirAsync(projectMetadataPath);
                await copyAsync(originalProjectMetadata, testProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(projectMetadataPath))) {
                await unlinkAsync(testProjectMetadata);
                await rmdirAsync(projectMetadataPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "healthSettings": {
                    "healthCheck": "hi"
                },
                "result": "success"
            },
            "combo2": {
                "healthSettings": {
                    "healthCheck": "<script>alert(\"xss\");</script>"
                },
                "result": "failed"
            },
            "combo3": {
                "healthSettings": {
                    "healthCheck": ""
                },
                "result": "success"
            }
        };

        for (const combo of Object.keys(combinations)) {
            const healthSettings = combinations[combo]["healthSettings"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => healthSettings: " + JSON.stringify(healthSettings), async () => {
                const projectID: string = "dummynodeproject";

                await projectSettings.projectSpecificationHandler(projectID, healthSettings);
                expect(healthCheckStatus).to.equal(expectedResult);
            });
        }
    });

    describe("combinational testing of changeStatusPingTimeout function", () => {

        const projectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const originalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const testProjectMetadata = path.join(projectMetadataPath, "dummynodeproject.json");

        before("create test directories", async () => {
            if (!(await existsAsync(projectMetadataPath))) {
                await mkdirAsync(projectMetadataPath);
                await copyAsync(originalProjectMetadata, testProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(projectMetadataPath))) {
                await unlinkAsync(testProjectMetadata);
                await rmdirAsync(projectMetadataPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "statusPingTimeoutSettings": {
                    "statusPingTimeout": "10"
                },
                "result": 10
            },
            "combo2": {
                "statusPingTimeoutSettings": {
                    "statusPingTimeout": "test"
                },
                "result": 30
            }
        };

        for (const combo of Object.keys(combinations)) {
            const statusPingTimeoutSettings = combinations[combo]["statusPingTimeoutSettings"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => statusPingTimeoutSettings: " + JSON.stringify(statusPingTimeoutSettings), async () => {
                const projectID: string = "dummynodeproject";

                await projectSettings.projectSpecificationHandler(projectID, statusPingTimeoutSettings);
                expect(statusPingTimeoutValue).to.equal(expectedResult);
            });
        }
    });


    describe("combinational testing of changeMavenProfiles function", () => {

        const nodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const nodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const nodeTestProjectMetadata = path.join(nodeProjectMetadataPath, "dummynodeproject.json");

        const springProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyspringproject");
        const springOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyspringproject.json");
        const springTestProjectMetadata = path.join(springProjectMetadataPath, "dummyspringproject.json");

        before("create test directories", async () => {
            if (!(await existsAsync(nodeProjectMetadataPath))) {
                await mkdirAsync(nodeProjectMetadataPath);
                await copyAsync(nodeOriginalProjectMetadata, nodeTestProjectMetadata);
            }

            if (!(await existsAsync(springProjectMetadataPath))) {
                await mkdirAsync(springProjectMetadataPath);
                await copyAsync(springOriginalProjectMetadata, springTestProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(nodeProjectMetadataPath))) {
                await unlinkAsync(nodeTestProjectMetadata);
                await rmdirAsync(nodeProjectMetadataPath);
            }

            if ((await existsAsync(springProjectMetadataPath))) {
                await unlinkAsync(springTestProjectMetadata);
                await rmdirAsync(springProjectMetadataPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "mavenProfilesSettings": {
                    "mavenProfiles": "hi"
                },
                "result": "failed"
            },
            "combo2": {
                "mavenProfilesSettings": {
                    "mavenProfiles": ["hi"]
                },
                "result": "failed"
            },
            "combo3": {
                "mavenProfilesSettings": {
                    "mavenProfiles": ["hi"]
                },
                "result": "success"
            },
            "combo4": {
                "mavenProfilesSettings": {
                    "mavenProfiles": []
                },
                "result": "success"
            }
        };

        for (const combo of Object.keys(combinations)) {
            const mavenProfilesSettings = combinations[combo]["mavenProfilesSettings"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => mavenProfilesSettings: " + JSON.stringify(mavenProfilesSettings), async () => {
                let projectID: string = "dummynodeproject";

                if (combo == "combo3" || combo == "combo4") {
                    projectID = "dummyspringproject";
                }

                await projectSettings.projectSpecificationHandler(projectID, mavenProfilesSettings);
                expect(mavenProfilesStatus).to.equal(expectedResult);
            });
        }
    });

    describe("combinational testing of changeMavenProperties function", () => {

        const nodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const nodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const nodeTestProjectMetadata = path.join(nodeProjectMetadataPath, "dummynodeproject.json");

        const springProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyspringproject");
        const springOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyspringproject.json");
        const springTestProjectMetadata = path.join(springProjectMetadataPath, "dummyspringproject.json");

        before("create test directories", async () => {
            if (!(await existsAsync(nodeProjectMetadataPath))) {
                await mkdirAsync(nodeProjectMetadataPath);
                await copyAsync(nodeOriginalProjectMetadata, nodeTestProjectMetadata);
            }

            if (!(await existsAsync(springProjectMetadataPath))) {
                await mkdirAsync(springProjectMetadataPath);
                await copyAsync(springOriginalProjectMetadata, springTestProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(nodeProjectMetadataPath))) {
                await unlinkAsync(nodeTestProjectMetadata);
                await rmdirAsync(nodeProjectMetadataPath);
            }

            if ((await existsAsync(springProjectMetadataPath))) {
                await unlinkAsync(springTestProjectMetadata);
                await rmdirAsync(springProjectMetadataPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "mavenPropertiesSettings": {
                    "mavenProperties": "hi=hi"
                },
                "result": "failed"
            },
            "combo2": {
                "mavenPropertiesSettings": {
                    "mavenProperties": ["hi=hi"]
                },
                "result": "failed"
            },
            "combo3": {
                "mavenPropertiesSettings": {
                    "mavenProperties": ["hi=hi"]
                },
                "result": "success"
            },
            "combo4": {
                "mavenPropertiesSettings": {
                    "mavenProperties": []
                },
                "result": "success"
            }
        };

        for (const combo of Object.keys(combinations)) {
            const mavenPropertiesSettings = combinations[combo]["mavenPropertiesSettings"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => mavenPropertiesSettings: " + JSON.stringify(mavenPropertiesSettings), async () => {
                let projectID: string = "dummynodeproject";

                if (combo == "combo3" || combo == "combo4") {
                    projectID = "dummyspringproject";
                }

                await projectSettings.projectSpecificationHandler(projectID, mavenPropertiesSettings);
                expect(mavenPropertiesStatus).to.equal(expectedResult);
            });
        }
    });

    describe("combinational testing of reconfigIgnoredFilesForDaemon function", () => {

        const nodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const nodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const nodeTestProjectMetadata = path.join(nodeProjectMetadataPath, "dummynodeproject.json");

        before("create test directories", async () => {
            if (!(await existsAsync(nodeProjectMetadataPath))) {
                await mkdirAsync(nodeProjectMetadataPath);
                await copyAsync(nodeOriginalProjectMetadata, nodeTestProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(nodeProjectMetadataPath))) {
                await unlinkAsync(nodeTestProjectMetadata);
                await rmdirAsync(nodeProjectMetadataPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "ignoredPathsSettings": {
                    "ignoredPaths": "Dockerfile"
                },
                "result": "failed"
            }, "combo2": {
                "ignoredPathsSettings": {
                    "ignoredPaths": ["Dockerfile"]
                },
                "result": "success"
            }, "combo3": {
                "ignoredPathsSettings": {
                    "ignoredPaths": []
                },
                "result": "success"
            }
        };

        for (const combo of Object.keys(combinations)) {
            const ignoredPathsSettings = combinations[combo]["ignoredPathsSettings"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => ignoredPathsSettings: " + JSON.stringify(ignoredPathsSettings), async () => {
                const projectID: string = "dummynodeproject";

                await projectSettings.projectSpecificationHandler(projectID, ignoredPathsSettings);
                expect(ignoredPathsStatus).to.equal(expectedResult);
            });
        }
    });

    describe("combinational testing of projectSpecificationHandler function", () => {

        const nodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const nodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const nodeTestProjectMetadata = path.join(nodeProjectMetadataPath, "dummynodeproject.json");

        before("create test directories", async () => {
            if (!(await existsAsync(nodeProjectMetadataPath))) {
                await mkdirAsync(nodeProjectMetadataPath);
                await copyAsync(nodeOriginalProjectMetadata, nodeTestProjectMetadata);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(nodeProjectMetadataPath))) {
                await unlinkAsync(nodeTestProjectMetadata);
                await rmdirAsync(nodeProjectMetadataPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "projectSpecificationHandlerSetting": {
                    "garbageKey": "Dockerfile"
                },
                "result": "failed"
            },
            "combo2": {
                "projectSpecificationHandlerSetting": {
                    "internalPort": undefined
                },
                "result": "failed"
            }
        };

        for (const combo of Object.keys(combinations)) {
            const projectSpecificationHandlerSetting = combinations[combo]["projectSpecificationHandlerSetting"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => projectSpecificationHandlerSetting: " + JSON.stringify(projectSpecificationHandlerSetting), async () => {
                const projectID: string = "dummynodeproject";

                await projectSettings.projectSpecificationHandler(projectID, projectSpecificationHandlerSetting);
                expect(projectSettingsStatus).to.equal(expectedResult);
            });
        }
    });
}