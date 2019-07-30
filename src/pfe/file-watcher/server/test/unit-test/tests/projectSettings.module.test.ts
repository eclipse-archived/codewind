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
import { promisify } from "util";
import * as projectSettings from "../../../src/projects/projectSpecifications";
import * as socket from "../../../src/utils/socket";
import * as app_configs from "../../functional-test/configs/app.config";

const existsAsync = promisify(fs.exists);
const mkdirAsync = promisify(fs.mkdir);
const copyAsync = promisify(fs.copyFile);
const rmdirAsync = promisify(fs.rmdir);
const unlinkAsync = promisify(fs.unlink);

export function projectSettingsTestModule(): void {

    describe("Project Settings Unit Test", () => {
        let contextRootStatus = "";
        let healthCheckStatus = "";
        let mavenProfilesStatus = "";
        let mavenPropertiesStatus = "";

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
                    }
                }
            }
        });

        describe("Combinational testing of changeContextRoot function", () => {

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

        describe("Combinational testing of changeHealthCheck function", () => {

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

        describe("Combinational testing of changeMavenProfiles function", () => {

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
                }
            };

            for (const combo of Object.keys(combinations)) {
                const mavenProfilesSettings = combinations[combo]["mavenProfilesSettings"];
                const expectedResult = combinations[combo]["result"];

                it(combo + " => mavenProfilesSettings: " + JSON.stringify(mavenProfilesSettings), async () => {
                    let projectID: string = "dummynodeproject";

                    if (combo == "combo3") {
                        projectID = "dummyspringproject";
                    }

                    await projectSettings.projectSpecificationHandler(projectID, mavenProfilesSettings);
                    expect(mavenProfilesStatus).to.equal(expectedResult);
                });
            }
        });

        describe("Combinational testing of changeMavenProperties function", () => {

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
                }
            };

            for (const combo of Object.keys(combinations)) {
                const mavenPropertiesSettings = combinations[combo]["mavenPropertiesSettings"];
                const expectedResult = combinations[combo]["result"];

                it(combo + " => mavenPropertiesSettings: " + JSON.stringify(mavenPropertiesSettings), async () => {
                    let projectID: string = "dummynodeproject";

                    if (combo == "combo3") {
                        projectID = "dummyspringproject";
                    }

                    await projectSettings.projectSpecificationHandler(projectID, mavenPropertiesSettings);
                    expect(mavenPropertiesStatus).to.equal(expectedResult);
                });
            }
        });
    });
}