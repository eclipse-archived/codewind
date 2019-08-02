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

import * as springProject from "../../../src/projects/springProject";
import * as socket from "../../../src/utils/socket";
import * as app_configs from "../../functional-test/configs/app.config";
import { existsAsync, mkdirAsync, copyAsync, rmdirAsync, unlinkAsync } from "../../functional-test/lib/utils";


export function springProjectTestModule(): void {

    const libertyDummyProjectPath = path.join(app_configs.projectDataDir, "libertyDummyProject");
    const originalLibertyPOM = path.join(app_configs.projectDataDir, "dummymicroprofilepom.xml");
    const testLibertyPOM = path.join(libertyDummyProjectPath, "pom.xml");

    const springDummyProjectPath = path.join(app_configs.projectDataDir, "springDummyProject");
    const originalSpringPOM = path.join(app_configs.projectDataDir, "dummyspringpom.xml");
    const testSpringPOM = path.join(springDummyProjectPath, "pom.xml");

    describe("testing of typeMatches function", () => {

        before("create test directories", async () => {
            if (!(await existsAsync(libertyDummyProjectPath))) {
                await mkdirAsync(libertyDummyProjectPath);
                await copyAsync(originalLibertyPOM, testLibertyPOM);
            }

            if (!(await existsAsync(springDummyProjectPath))) {
                await mkdirAsync(springDummyProjectPath);
                await copyAsync(originalSpringPOM, testSpringPOM);
            }
        });

        after("remove test directories", async () => {
            if ((await existsAsync(libertyDummyProjectPath))) {
                await unlinkAsync(testLibertyPOM);
                await rmdirAsync(libertyDummyProjectPath);
            }

            if ((await existsAsync(springDummyProjectPath))) {
                await unlinkAsync(testSpringPOM);
                await rmdirAsync(springDummyProjectPath);
            }
        });

        const combinations: any = {
            "combo1": {
                "location": libertyDummyProjectPath,
                "result": false
            },
            "combo2": {
                "location": springDummyProjectPath,
                "result": true
            }
        };

        for (const combo of Object.keys(combinations)) {
            const location = combinations[combo]["location"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => typeMatches: " + location, async () => {
                const isSpringProject: boolean = await springProject.typeMatches(location);
                expect(isSpringProject).to.equal(expectedResult);
            });
        }
    });

}