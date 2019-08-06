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

import * as constants from "../../../../server/src/projects/constants";
import * as projectUtil from "../../../../server/src/projects/projectUtil";


export function projectUtilTestModule(): void {
    describe("combinational testing of getProjectMavenSettings function", () => {
        const projectID = "testProjectID";
        const combinations: any = {
            "combo1": {
                "data": {
                    projectID: projectID
                },
                "result": ""
            },
            "combo2": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: ""
                },
                "result": ""
            },
            "combo3": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: [""],
                    mavenProperties: [""]
                },
                "result": ""
            },
            "combo4": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: ["profile1&"]
                },
                "result": "Error: The user maven settings have invalid characters for the project"
            },
            "combo5": {
                "data": {
                    projectID: projectID,
                    mavenProperties: ["key=value;"]
                },
                "result": "Error: The user maven settings have invalid characters for the project"
            },
            "combo6": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: ["profile1"],
                    mavenProperties: ["key=value"]
                },
                "result": "-P profile1 -D key=value "
            },
            "combo7": {
                "data": {
                    projectID: projectID,
                    mavenProfiles: ["profile1", "profile2"],
                    mavenProperties: ["key1=value1", "key2=value2"]
                },
                "result": "-P profile1,profile2 -D key1=value1 -D key2=value2 "
            },
        };
        for (const combo of Object.keys(combinations)) {

            const data = combinations[combo]["data"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => data: " + JSON.stringify(data), async() => {
                try {
                    const actualResult = await projectUtil.getProjectMavenSettings(data);
                    console.log("actualResult: " + actualResult);
                    expect(actualResult).to.equal(expectedResult);
                } catch (err) {
                    expect(err.toString()).to.equal(expectedResult);
                }
            });
        }
    });

}
