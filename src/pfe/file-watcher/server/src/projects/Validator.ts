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
import * as utils from "../utils/utils";
import * as io from "../utils/socket";
import * as locale from "../utils/locale";
import * as logger from "../utils/logger";
import { Operation } from "./operation";
import { getProjectNameFromPath } from "./projectUtil";

/**
 * @class
 * @description The class representing project validation.
 */
export class Validator {

    operationId: string;
    projectType: string;
    location: string;
    projectID: string;
    status: string;
    results: any[];

    /**
     * @constructor
     * @description Constructor of Validator class.
     *
     * @param operation <Required | Operation> - The validate operation.
     */
    constructor(operation: Operation) {
      this.operationId = operation.operationId;
      this.projectType = operation.projectInfo.projectType;
      this.location = operation.projectInfo.location;
      if (operation.projectInfo.projectID) {
          this.projectID = operation.projectInfo.projectID;
      }

      this.status = "success"; // default value is success
      this.results = [];
    }

    /**
     * @function
     * @description Validate required files for the respective project.
     *
     * @param requiredFiles <Required | String[]> - List of required files for a given project.
     *
     * @returns Promise<void>
     */
    async validateRequiredFiles (requiredFiles: string[]): Promise<void> {
        if (requiredFiles) {
            const projectID = this.projectID;
            const projectName = getProjectNameFromPath(this.location);
            const OR_SPLIT = "|";

            try {
                logger.logProjectInfo("Checking for required files", projectID, projectName);
                // Check for missing files
                for (let i = 0; i < requiredFiles.length; i++) {
                    logger.logProjectInfo("Checking for required file " + requiredFiles[i], projectID, projectName);

                    // check if the OR keyword was passed in the required files
                    if (requiredFiles[i].indexOf(OR_SPLIT) > 0) {
                        // get the list of OR splitted files
                        const OR_FILES = requiredFiles[i].split(OR_SPLIT);

                        // if there are at least one file in the OR split
                        // iterate through the file list and check if at least one of the files exist
                        if (OR_FILES.length > 0) {
                            let found_file = false;

                            // iterate through the file list and check if at least one of the files exist
                            // break out when at least one of the OR files have been found
                            for (let j = 0; j < OR_FILES.length; j++) {
                                const OR_FILE = OR_FILES[j].trim();
                                const file = `${this.location}` + OR_FILE;
                                found_file = await utils.asyncFileExists(file);
                                if (found_file) break;
                            }

                            // if none of the OR files were found
                            // iterate through the file list and throw validation error on each of the files
                            if (!found_file) {
                                // take the first element as the main file we are looking for
                                // e.g. Dockerfile | Dockerfile-lang
                                const missingFile = OR_FILES[0].trim();
                                const filepath = (`${this.location}` + missingFile).replace("/codewind-workspace/", "");
                                const missingFileList = requiredFiles[i].replace(/\//g, "").replace(/\|/g, "or");
                                const error: ValidationResult = {
                                    severity: Severity.error,
                                    filename: this.getFileName(missingFile),
                                    filepath: filepath,
                                    type: ProblemType.missing,
                                    label: await locale.getTranslation("validator.requiredFiles.label"),
                                    details: await locale.getTranslation("validator.requiredFiles.orDetails", { missingFileList: missingFileList }),
                                    quickfix: {
                                        fixID: FixID.generateMissingFiles,
                                        name: await locale.getTranslation("quickfix.generateMissingFilesName"),
                                        description: await locale.getTranslation("quickfix.generateMissingFilesDescription")
                                       }
                                };
                                this.results.push(error);
                                logger.logProjectError("Missing files: " + missingFileList, projectID, projectName);
                            }
                        }
                    } else {
                        const file = `${this.location}` + requiredFiles[i];
                        const filepath = file.replace("/codewind-workspace/", "");
                        if (!await utils.asyncFileExists(file)) {
                            const filename = this.getFileName(requiredFiles[i]);
                            const error: ValidationResult = {
                                severity: Severity.error,
                                filename: filename,
                                filepath: filepath,
                                type: ProblemType.missing,
                                label: await locale.getTranslation("validator.requiredFiles.label"),
                                details: await locale.getTranslation("validator.requiredFiles.details", { filename: filename }),
                                quickfix: {
                                    fixID: FixID.generateMissingFiles,
                                    name: await locale.getTranslation("quickfix.generateMissingFilesName"),
                                    description: await locale.getTranslation("quickfix.generateMissingFilesDescription")
                                   }
                            };
                            this.results.push(error);
                            logger.logProjectError("Missing file: " + requiredFiles[i], projectID, projectName);
                        }
                    }
                }
            } catch (err) {
                logger.logProjectError("An error occurred while validating required files.", projectID, projectName);
                logger.logProjectError(err, projectID, projectName);
            }
        }
    }

    /**
     * @function
     * @description Get file name from the given path.
     *
     * @param path <String> - The file path location.
     *
     * @returns string
     */
    getFileName(path: string): string {
        const index = path.lastIndexOf("/");
        if (index > -1) {
            return path.substring(index + 1);
        }
        return path;
    }

    /**
     * @function
     * @description Set the validation result.
     *
     * @returns {}
     */
    result(): {} {
        if (this.results.length > 0) {
            this.status = "failed";
        }
        let validationResult = {};
        validationResult = this;
        return validationResult;
    }

    /**
     * @function
     * @description Send the validation result.
     *
     * @returns void
     */
    sendResult(): void {
        const projectID = this.projectID;
        const projectName = getProjectNameFromPath(this.location);
        logger.logProjectInfo("Sending validation result", projectID, projectName);
        io.emitOnListener("projectValidated", this.result());
    }
}

/**
 * @class
 * @description The class representing the validation results.
 */
export class ValidationResult {

    severity: Severity;
    filename: string;
    filepath: string;
    type: ProblemType;
    label: string;
    details: string;
    quickfix?: {
        fixID: string,
        name: string,
        description: string
    };

    /**
     * @constructor
     * @description Constructor of ValidationResult class.
     *
     * @param severity <Required | Severity> - The severity of the validation.
     * @param filename <Required | String> - The name of the file validated.
     * @param filepath <Required | String> - The path of the file validate.
     * @param type <Required | ProblemType> - The type of problem validation caught.
     * @param label <Required | String> - The label of the validation.
     * @param details <Required | String> - Additional details of the validation.
     */
    constructor(severity: Severity, filename: string, filepath: string, type: ProblemType, label: string, details: string) {
        this.severity = severity;
        this.filename = filename;
        this.filepath = filepath;
        this.type = type;
        this.label = label;
        this.details = details;
    }
}

export enum Severity {
    error = "error",
    warning = "warning"
}

export enum ProblemType {
    invalid = "invalid",
    missing = "missing"
}

export enum FixID {
    generateMissingFiles = "generateMissingFiles"
}
