import { expect } from "chai";
import * as path from "path";
import * as app_configs from "../../functional-test/configs/app.config";
import { existsAsync, mkdirAsync, copyAsync, rmdirAsync, unlinkAsync, writeAsync } from "../../functional-test/lib/utils";
import * as actions from "../../../src/projects/actions";
import { workspaceConstants } from "../../../src/projects/constants";

export function actionsTestModule(): void {
    describe("combinational testing of build function", () => {
        // only test the failure case, since success case requires the app container up and running
        const combinations: any = {
            "combo1": {
                "args": {},
                "result": "BAD_REQUEST"
            },
            "combo2": {
                "args": { projectID: "testprojectID" },
                "result": "FILE_NOT_EXIST"
            }
        };

        for (const combo of Object.keys(combinations)) {
            const args = combinations[combo]["args"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => args: " + JSON.stringify(args) , async() => {
                try {
                    await actions.build(args);
                } catch (err) {
                    expect(err.name).to.equal(expectedResult);
                }
            });
        }
    });

    describe("combinational testing of restart function", () => {
        // only test the failure case, since success case requires the app container up and running
        const combinations: any = {
            "combo1": {
                "args": {},
                "result": "BAD_REQUEST: The project id was not provided"
            },
            "combo2": {
                "args": { projectID: "testprojectID" },
                "result": "BAD_REQUEST: The startMode was not provided"
            },
            "combo3": {
                "args": { projectID: "testprojectID", startMode: "invalidStartMode"},
                "result": 'BAD_REQUEST: The startMode "invalidStartMode" is not recognized'
            },
            "combo4": {
                "args": { projectID: "testprojectID", startMode: "run"},
                "K8": false,
                "result": "FILE_NOT_EXIST: No project found for project id: testprojectID"
            },
            "combo5": {
                "args": { projectID: "testprojectID", startMode: "run"},
                "K8": true,
                "result": "BAD_REQUEST: Restart is not supported for Kubernetes"
            },
        };

        for (const combo of Object.keys(combinations)) {
            const args = combinations[combo]["args"];
            const expectedResult = combinations[combo]["result"];
            const K8 = combinations[combo]["K8"];

            it(combo + " => args: " + JSON.stringify(args) , async() => {
                try {
                    if (K8 === true) {
                        process.env.IN_K8 = "true";
                    }
                    await actions.restart(args);
                    process.env.IN_K8 = "false";
                } catch (err) {
                    expect(err.toString()).to.equal(expectedResult);
                }
            });
        }
    });

    describe("combinational testing of enableautobuild & disableautobuildfunction", () => {

        const nodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummynodeproject");
        const nodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummynodeproject.json");
        const nodeTestProjectMetadata = path.join(nodeProjectMetadataPath, "dummynodeproject.json");

        const swiftProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyswiftproject");
        const swiftOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyswiftproject.json");
        const swiftTestProjectMetadata = path.join(swiftProjectMetadataPath, "dummyswiftproject.json");

        const springProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyspringproject");
        const springOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyspringproject.json");
        const springTestProjectMetadata = path.join(springProjectMetadataPath, "dummyspringproject.json");

        const libertyProjectMetadataPath = path.join(app_configs.projectDataDir, "dummymicroprofileproject");
        const libertyOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummymicroprofileproject.json");
        const libertyTestProjectMetadata = path.join(libertyProjectMetadataPath, "dummymicroprofileproject.json");

        const goProjectMetadataPath = path.join(app_configs.projectDataDir, "dummygoproject");
        const goOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummygoproject.json");
        const goTestProjectMetadata = path.join(goProjectMetadataPath, "dummygoproject.json");

        const appsodyNodeProjectMetadataPath = path.join(app_configs.projectDataDir, "dummyappsodyproject");
        const appsodyNodeOriginalProjectMetadata = path.join(app_configs.projectDataDir, "dummyappsodyproject.json");
        const appsodyNodeTestProjectMetadata = path.join(appsodyNodeProjectMetadataPath, "dummyappsodyproject.json");

        const extensionsPath = workspaceConstants.workspaceExtensionDir;
        const appsodyExtensionPath = path.join(extensionsPath, "appsodyExtension");

        const appsodyExtensionTestArtifactPath1 = path.join(appsodyExtensionPath, ".sh-extension");
        const appsodyExtensionTestArtifactPath2 = path.join(appsodyExtensionPath, "entrypoint.sh");


        before("create test directories", async () => {
            if (!(await existsAsync(nodeProjectMetadataPath))) {
                await mkdirAsync(nodeProjectMetadataPath);
                await copyAsync(nodeOriginalProjectMetadata, nodeTestProjectMetadata);
            }

            if (!(await existsAsync(swiftProjectMetadataPath))) {
                await mkdirAsync(swiftProjectMetadataPath);
                await copyAsync(swiftOriginalProjectMetadata, swiftTestProjectMetadata);
            }

            if (!(await existsAsync(springProjectMetadataPath))) {
                await mkdirAsync(springProjectMetadataPath);
                await copyAsync(springOriginalProjectMetadata, springTestProjectMetadata);
            }

            if (!(await existsAsync(libertyProjectMetadataPath))) {
                await mkdirAsync(libertyProjectMetadataPath);
                await copyAsync(libertyOriginalProjectMetadata, libertyTestProjectMetadata);
            }

            if (!(await existsAsync(goProjectMetadataPath))) {
                await mkdirAsync(goProjectMetadataPath);
                await copyAsync(goOriginalProjectMetadata, goTestProjectMetadata);
            }

            if (!(await existsAsync(appsodyNodeProjectMetadataPath))) {
                await mkdirAsync(appsodyNodeProjectMetadataPath);
                await copyAsync(appsodyNodeOriginalProjectMetadata, appsodyNodeTestProjectMetadata);
            }

            if (!(await existsAsync(extensionsPath))) {
                await mkdirAsync(extensionsPath);
                if (!await existsAsync(appsodyExtensionPath)) {
                    await mkdirAsync(appsodyExtensionPath);
                    await writeAsync(appsodyExtensionTestArtifactPath1, '{"container": {"prefix": "testprefix-", "suffix": "-testsuffix"}}');
                    await writeAsync(appsodyExtensionTestArtifactPath2, "echo $(pwd)");
                }
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

            if ((await existsAsync(springProjectMetadataPath))) {
                await unlinkAsync(springTestProjectMetadata);
                await rmdirAsync(springProjectMetadataPath);
            }

            if ((await existsAsync(libertyProjectMetadataPath))) {
                await unlinkAsync(libertyTestProjectMetadata);
                await rmdirAsync(libertyProjectMetadataPath);
            }

            if ((await existsAsync(goProjectMetadataPath))) {
                await unlinkAsync(goTestProjectMetadata);
                await rmdirAsync(goProjectMetadataPath);
            }

            if ((await existsAsync(appsodyNodeProjectMetadataPath))) {
                await unlinkAsync(appsodyNodeTestProjectMetadata);
                await rmdirAsync(appsodyNodeProjectMetadataPath);
            }

            if ((await existsAsync(extensionsPath))) {
                if (await existsAsync(appsodyExtensionPath)) {
                    await unlinkAsync(appsodyExtensionTestArtifactPath1);
                    await unlinkAsync(appsodyExtensionTestArtifactPath2);
                    await rmdirAsync(appsodyExtensionPath);
                }
                await rmdirAsync(extensionsPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "args": {},
                "result": "BAD_REQUEST"
            },
            "combo2": {
                "args": { projectID: "dummynodeproject" },
                "result": "success"
            },
            "combo3": {
                "args": { projectID: "dummyswiftproject" },
                "result": "success"
            },
            "combo4": {
                "args": { projectID: "dummyspringproject" },
                "result": "success"
            },
            "combo5": {
                "args": { projectID: "dummymicroprofileproject" },
                "result": "success"
            },
            "combo6": {
                "args": { projectID: "dummygoproject" },
                "result": "success"
            },
            "combo7": {
                "args": { projectID: "dummyappsodyproject" },
                "result": "success"
            },
        };

        for (const combo of Object.keys(combinations)) {
            const args = combinations[combo]["args"];
            const expectedResult = combinations[combo]["result"];

            it(combo + "enableautobuild => args: " + JSON.stringify(args) , async() => {
                try {
                    const actualResult = await actions.enableautobuild(args);
                    expect(actualResult.status).to.equal(expectedResult);
                } catch (err) {
                    expect(err.name).to.equal(expectedResult);
                }
            });

            it(combo + "disableautobuild => args: " + JSON.stringify(args) , async() => {
                try {
                    const actualResult = await actions.disableautobuild(args);
                    expect(actualResult.status).to.equal(expectedResult);
                } catch (err) {
                    expect(err.name).to.equal(expectedResult);
                }
            });
        }
    });

}