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
import path from "path";
import fs from "fs";

const filepath = path.resolve(__dirname, "data", process.env.TEST_TYPE, process.env.TURBINE_PERFORMANCE_TEST, "performance-data.json");
const data: any = JSON.parse(fs.readFileSync(filepath, "utf-8"));
const applicationTypes = Object.keys(data);

const performanceObject: any = {};

for (const appType of applicationTypes) {
    const projectLang = Object.keys(data[appType]);
    for (const lang of projectLang) {
        const iterations = Object.keys(data[appType][lang]);
        performanceObject[`${appType}-${lang}`] = {};
        for (const iteration of iterations) {
            for (const performanceKey of Object.keys(data[appType][lang][iteration])) {
                if (!performanceObject[`${appType}-${lang}`][performanceKey]) performanceObject[`${appType}-${lang}`][performanceKey] = 0;
                performanceObject[`${appType}-${lang}`][performanceKey] = performanceObject[`${appType}-${lang}`][performanceKey] + data[appType][lang][iteration][performanceKey];
            }
        }
        for (const performanceKey of Object.keys(performanceObject[`${appType}-${lang}`])) {
            performanceObject[`${appType}-${lang}`][performanceKey] = (performanceObject[`${appType}-${lang}`][performanceKey] / iterations.length).toFixed(4);
        }
    }
}

console.log(">> Saved average performance data for each project");
fs.writeFileSync(path.join(__dirname, "data", process.env.TEST_TYPE, process.env.TURBINE_PERFORMANCE_TEST, "average-performance-data.json"), JSON.stringify(performanceObject));
