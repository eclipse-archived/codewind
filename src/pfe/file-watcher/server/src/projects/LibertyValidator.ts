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
import { Operation } from "./operation";
import * as locale from "../utils/locale";

/**
 * @class
 * @extends Validator
 * @description The class representing the liberty project validation.
 */
export class LibertyValidator extends Validator {

    operation: Operation;

    /**
     * @constructor
     * @description Constructor of LibertyValidator class extending Validator.
     *
     * @param operation <Required | Operation> - The validate operation.
     */
    constructor(operation: Operation) {
        super(operation);
        this.operation = operation;
    }

    /**
     * @function
     * @description Validate POM files for a libery project.
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

                    const filename = Validator.prototype.getFileName(pomLocation);
                    pomLocation = pomLocation.replace("/codewind-workspace/", "");

                    // Validate parent is liberty maven parent
                    try {
                        const parentGroupId = parsedData.project.parent[0].groupId;
                        if (parentGroupId != "net.wasdev.wlp.maven.parent") {
                            const result = new ValidationResult(
                                Severity.error,
                                filename,
                                pomLocation,
                                ProblemType.invalid,
                                await locale.getTranslation("libertyProject.validator.parentGroupId.label"),
                                await locale.getTranslation("libertyProject.validator.parentGroupId.details")
                            );
                            resultsArr.push(result);
                        }

                        const parentArtifactId = parsedData.project.parent[0].artifactId;
                        if (parentArtifactId != "liberty-maven-app-parent") {
                            const result = new ValidationResult(
                                Severity.error,
                                filename,
                                pomLocation,
                                ProblemType.invalid,
                                await locale.getTranslation("libertyProject.validator.parentArtifactId.label"),
                                await locale.getTranslation("libertyProject.validator.parentArtifactId.details")
                            );
                            resultsArr.push(result);
                        }
                    } catch (err) {
                        const result = new ValidationResult(
                            Severity.error,
                            filename,
                            pomLocation,
                            ProblemType.invalid,
                            await locale.getTranslation("libertyProject.validator.parentPOM.label"),
                            await locale.getTranslation("libertyProject.validator.parentPOM.details")
                        );
                        resultsArr.push(result);
                    }

                    // Validate microclimate profile available
                    let microclimateProfileFound = false;

                    try {
                        await Promise.all(parsedData.project.profiles[0].profile.map(async (mcprofile: any) => {
                            if (mcprofile.id[0] === "microclimate") {

                                microclimateProfileFound = true;

                                // Validate activation property
                                let activationFound = false;
                                try {
                                    if (mcprofile.activation[0].property) {
                                        mcprofile.activation[0].property.forEach((prop: any) => {
                                            if (prop.name[0] === "libertyEnv" && prop.value[0] === "microclimate") {
                                                activationFound = true;
                                            }
                                        });
                                    }
                                } catch (ex) {
                                    logger.logInfo("No microclimate activation property was found.");
                                }

                                if (!activationFound) {
                                    const result = new ValidationResult(
                                        Severity.error,
                                        filename,
                                        pomLocation,
                                        ProblemType.invalid,
                                        await locale.getTranslation("libertyProject.validator.activationNotFound.label"),
                                        await locale.getTranslation("libertyProject.validator.activationNotFound.details")
                                    );
                                    resultsArr.push(result);
                                }

                                // Validate liberty-maven-plugin
                                let libertyPluginFound = false;
                                try {
                                    if (mcprofile.build[0].plugins[0].plugin) {
                                        mcprofile.build[0].plugins[0].plugin.forEach(async (_plugin: any) => {
                                            if (_plugin.groupId[0] === "net.wasdev.wlp.maven.plugins" && _plugin.artifactId[0] === "liberty-maven-plugin") {
                                                libertyPluginFound = true;

                                                // Validate liberty plugin
                                                const libertyPlugin = _plugin;
                                                if (libertyPlugin.extensions[0] !== "true") {
                                                    const result = new ValidationResult(
                                                        Severity.error,
                                                        filename,
                                                        pomLocation,
                                                        ProblemType.invalid,
                                                        await locale.getTranslation("libertyProject.validator.pluginExtensions.label"),
                                                        await locale.getTranslation("libertyProject.validator.pluginExtensions.details")
                                                    );
                                                    resultsArr.push(result);
                                                }

                                                if (libertyPlugin.configuration) {
                                                    let looseAppConfig: any;

                                                    libertyPlugin.configuration.forEach((_configuration: any) => {
                                                        if (_configuration.looseApplication) {
                                                            looseAppConfig = _configuration.looseApplication;
                                                        }
                                                    });

                                                    if (!looseAppConfig || looseAppConfig[0] !== "true") {
                                                        const result = new ValidationResult(
                                                            Severity.error,
                                                            filename,
                                                            pomLocation,
                                                            ProblemType.invalid,
                                                            await locale.getTranslation("libertyProject.validator.looseAppConfig.label"),
                                                            await locale.getTranslation("libertyProject.validator.looseAppConfig.details")
                                                        );
                                                        resultsArr.push(result);
                                                    }
                                                }

                                            }
                                        });
                                    }
                                } catch (ex) {
                                    logger.logInfo("No liberty-maven-plugin was found.");
                                }

                                if (!libertyPluginFound) {
                                    const result = new ValidationResult(
                                        Severity.error,
                                        filename,
                                        pomLocation,
                                        ProblemType.invalid,
                                        await locale.getTranslation("libertyProject.validator.libertyPluginNotFound.label"),
                                        await locale.getTranslation("libertyProject.validator.libertyPluginNotFound.details")
                                    );
                                    resultsArr.push(result);
                                }
                            }
                        }));
                    } catch (err) {
                        logger.logError("The project does not specify any build profiles.");
                    }

                    if (!microclimateProfileFound) {
                        logger.logInfo("A microclimate profile was not found");
                        const result = new ValidationResult(
                            Severity.error,
                            filename,
                            pomLocation,
                            ProblemType.invalid,
                            await locale.getTranslation("libertyProject.validator.microclimateProfileNotFound.label"),
                            await locale.getTranslation("libertyProject.validator.microclimateProfileNotFound.details")
                        );
                        resultsArr.push(result);
                    }
                    resolve(resultsArr);
                });
            });
        });
    }

    validateDockerfileBuild(fileLocation: string): Promise<ValidationResult[]> {
        return new Promise((resolve, reject) => {
            const resultsArr: ValidationResult[] = [];

            fs.readFile(fileLocation, async (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                const CHECK_STRING_1 = "PATH=/root/java/jre/bin:/opt/mvn/apache-maven/bin:$PATH";
                const CHECK_STRING_2 = "tar xf /opt/mvn/apache-maven-${MAVEN_VERSION}-bin.tar.gz -C /opt/mvn";
                // check if Dockerfile-Build still has root user settings for java and mvn path
                if (data.toString().trim().indexOf(CHECK_STRING_1) > -1 ||
                    data.toString().trim().indexOf(CHECK_STRING_2) > -1) {
                    const filename = Validator.prototype.getFileName(fileLocation);
                    fileLocation = fileLocation.replace("/codewind-workspace/", "");
                    const result = new ValidationResult(
                        Severity.error,
                        filename,
                        fileLocation,
                        ProblemType.invalid,
                        await locale.getTranslation("libertyProject.validator.migrateNonRootUser.label"),
                        await locale.getTranslation("libertyProject.validator.migrateNonRootUser.details")
                    );
                    resultsArr.push(result);
                }
                resolve(resultsArr);
            });
        });

    }

}
