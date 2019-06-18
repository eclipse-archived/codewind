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
"use strict";
import * as fs from "fs";
import * as xml2js from "xml2js";
import * as logger from "../utils/logger";
import { Validator, ValidationResult, Severity, ProblemType } from "./Validator";
import * as locale from "../utils/locale";

/**
 * @class
 * @extends Validator
 * @description The class representing the swift project validation.
 */
export class SpringValidator extends Validator {

    /**
     * @function
     * @description Validate POM files for a spring project.
     *
     * @param pomLocation <Required | String> - The pom file location.
     *
     * @returns Promise<ValidationResult[]>
     */
    validatePOM(pomLocation: string): Promise<ValidationResult[]> {

        return new Promise((resolve, reject) => {
            const resultsArr: ValidationResult[] = [];
            const parser = new xml2js.Parser();
            fs.readFile(pomLocation, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Parse XML
                parser.parseString(data, async (err: Error, parsedData: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    try {
                        const filename = Validator.prototype.getFileName(pomLocation);
                        pomLocation = pomLocation.replace("/codewind-workspace/", "");
                        const dependencies = parsedData.project.dependencies[0].dependency;
                        const packaging = parsedData.project.packaging;
                        let foundSpringGroupId = false;

                        // We only support Spring jar files for iterative development (undefined packaging defaults to jar)
                        if (packaging != undefined && packaging != "jar") {
                            const result = new ValidationResult(
                                Severity.error,
                                filename,
                                pomLocation,
                                ProblemType.invalid,
                                await locale.getTranslation("springProject.validator.foundInvalidPackaging.label"),
                                await locale.getTranslation("springProject.validator.foundInvalidPackaging.details")
                            );
                            resultsArr.push(result);
                        }
                        // Validate spring dependency
                        for (let i = 0; i < dependencies.length; i++) {
                            const value = dependencies[i];
                            if (value.groupId[0] === "org.springframework.boot") {
                                foundSpringGroupId = true;
                            }
                        }

                        if (!foundSpringGroupId) {
                            const result = new ValidationResult(
                                Severity.error,
                                filename,
                                pomLocation,
                                ProblemType.invalid,
                                await locale.getTranslation("springProject.validator.foundSpringGroupId.label"),
                                await locale.getTranslation("springProject.validator.foundSpringGroupId.details")
                            );
                            resultsArr.push(result);
                        }
                    } catch (err) {
                        logger.logProjectError("An error occurred while validating " + pomLocation, this.projectID);
                        logger.logProjectError(err, this.projectID);
                        resolve(resultsArr);
                    }
                    resolve(resultsArr);
                });
            });
        });
    }
}
