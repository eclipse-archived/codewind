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

import * as projectStatusController from "../../../../server/src/controllers/projectStatusController";
import * as socket from "../../../src/utils/socket";


export function projectStatusControllerTestModule(): void {
    const projectID = "testProject";
    it("getAppState of a non-exist project", async() => {
        const actualResult = await projectStatusController.getAppState(projectID);
        expect(actualResult).to.equal(projectStatusController.AppState.unknown);
    });

    it("getBuildState of a non-exist project", async() => {
        const actualResult = await projectStatusController.getBuildState(projectID);
        expect(actualResult).to.equal(projectStatusController.BuildState.unknown);
    });

    it("isBuildRequired of a non-exist project", async() => {
        const actualResult = await projectStatusController.isBuildRequired(projectID);
        expect(actualResult).to.equal(false);
    });

    describe("combinational testing of updateProjectStatus function", () => {
        before("add project to buildStateMap and appStateMap", async () => {
            await projectStatusController.addProject(projectID);
        });

        after("remove the test project", async () => {
            projectStatusController.deleteProject(projectID);
            const appStateResult = await projectStatusController.getAppState(projectID);
            expect(appStateResult).to.equal(projectStatusController.AppState.unknown);
            const buildStateResult = await projectStatusController.getBuildState(projectID);
            expect(buildStateResult).to.equal(projectStatusController.BuildState.unknown);
            const actualResult = await projectStatusController.isBuildRequired(projectID);
            expect(actualResult).to.equal(false);
        });

        const combinations: any = {
            "combo1": {
                data: {
                    projectID: projectID,
                    type: undefined
                },
                "result": { "statusCode": 400, "error": { "msg": "Missing required status type parameter"}}
            },
            "combo2": {
                data: {
                    projectID: projectID,
                    type: "invalidType"
                },
                "result": { "statusCode": 400, "error": { "msg": "Unrecognized status type: invalidType"}}
            },
            "combo3": {
                data: {
                    projectID: undefined,
                    type: projectStatusController.STATE_TYPES.buildState
                },
                "result": { "statusCode": 400, "error": { "msg": "Missing request parameters projectID or status for build state update"}}
            },
            "combo4": {
                data: {
                    projectID: projectID,
                    type: projectStatusController.STATE_TYPES.appState
                },
                "result": { "statusCode": 400, "error": { "msg": "Missing request parameters projectID or status for application state update"}}
            },
            "combo5": {
                data: {
                    projectID: projectID,
                    type: projectStatusController.STATE_TYPES.buildState,
                    buildStatus: "invalidState"
                },
                "result": { "statusCode": 400, "error": { "msg": "Invalid build state: invalidState"}}
            },
            "combo6": {
                data: {
                    projectID: projectID,
                    type: projectStatusController.STATE_TYPES.appState,
                    status: "invalidState"
                },
                "result": { "statusCode": 400, "error": { "msg": "Invalid application state: invalidState"}}
            },
            "combo7": {
                data: {
                    projectID: projectID,
                    type: projectStatusController.STATE_TYPES.appState,
                    status: projectStatusController.AppState.started,
                    error: "testMessage"
                },
                "result": { "statusCode": 200}
            },
            "combo8": {
                data: {
                    projectID: projectID,
                    type: projectStatusController.STATE_TYPES.buildState,
                    buildStatus: projectStatusController.BuildState.inProgress,
                    detailedBuildStatus: "testDetailedStatus",
                    appImageLastBuild: "123456789",
                    buildImageLastBuild: "123456789"
                },
                "result": { "statusCode": 200}
            },

        };
        for (const combo of Object.keys(combinations)) {

            const data = combinations[combo]["data"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => data: " + JSON.stringify(data), async() => {
                const actualResult = await projectStatusController.updateStatus(data);
                expect(actualResult).to.deep.equal(expectedResult);
                if (actualResult.statusCode === 200) {
                    if (data.type === projectStatusController.STATE_TYPES.appState) {
                        const appStateResult = await projectStatusController.getAppState(projectID);
                        expect(appStateResult).to.equal(data.status);
                    } else if (data.type === projectStatusController.STATE_TYPES.buildState) {
                        const buildStateResult = await projectStatusController.getBuildState(projectID);
                        expect(buildStateResult).to.equal(data.buildStatus);
                        const isBuildInProgress = await projectStatusController.isBuildInProgressOrQueued(projectID);
                        expect(isBuildInProgress).to.equal(true);
                    }
                }
            });
        }
    });


    describe("combinational testing of buildRequired function", () => {
        before("add project to buildStateMap and appStateMap", async () => {
            await projectStatusController.addProject(projectID);
        });

        after("remove the test project", async () => {
            projectStatusController.deleteProject(projectID);
            const appStateResult = await projectStatusController.getAppState(projectID);
            expect(appStateResult).to.equal(projectStatusController.AppState.unknown);
            const buildStateResult = await projectStatusController.getBuildState(projectID);
            expect(buildStateResult).to.equal(projectStatusController.BuildState.unknown);
            const actualResult = await projectStatusController.isBuildRequired(projectID);
            expect(actualResult).to.equal(false);
        });

        let buildRequired = "";

        socket.registerListener({
            name: "codewindunittest",
            handleEvent: (event, data) => {
                if (event === "projectStatusChanged") {
                    if (data.buildRequired) {
                        buildRequired = data.buildRequired;
                    }
                }
            }
        });

        it("set buildRequired to true ", async() => {
                await projectStatusController.buildRequired(projectID, true);
                expect(buildRequired).to.equal(true);
                const getBuildRequired = await projectStatusController.isBuildRequired(projectID);
                expect(getBuildRequired).to.equal(true);
                const getIsBuildInProgress = await projectStatusController.isBuildInProgressOrQueued(projectID);
                expect(getIsBuildInProgress).to.equal(false);
            });
    });
}
