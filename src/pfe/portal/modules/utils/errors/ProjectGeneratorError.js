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
const BaseError = require('./BaseError')

module.exports = class ProjectGeneratorError extends BaseError {
  constructor(code = '[Unknown error code]', projectName, message) {
    super(code, constructMessage(code, projectName, message));
  }
}

// Error codes
module.exports.INVALID_LANGUAGE = "INVALID_LANGUAGE";
module.exports.INVALID_SERVICE = "INVALID_SERVICE";
module.exports.INVALID_PROJECT_NAME = "INVALID_PROJECT_NAME";
module.exports.MISSING_FIELDS = "MISSING_FIELDS";
module.exports.INVALID_START_MODE = "INVALID_START_MODE";
module.exports.INVALID_FILE_NAME = "INVALID_FILE_NAME" 

/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from 
 * @param projectName, name of project the given error relates to. Can be null if not relevant
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, projectName, message) {
  let output = '';

  //If no project name is provided, no need to add a starter message
  let starter = (projectName) ? `Error generating files for project ${projectName}. ` : ''
  switch (code) {
  case "INVALID_LANGUAGE":
    output = `${code}: ${starter} Invalid language provided.`;
    break;
  case "INVALID_SERVICE":
    output = `${code}: ${starter} Invalid service name provided. Service names must consist of only lowercase character and/or numbers`;
    break;
  case "INVALID_PROJECT_NAME":
    output = `${code}: ${starter} Invalid project name provided. Project name must consist of only lowercase characters and/or numbers.`;
    break;
  case "MISSING_FIELDS":
    output = `${code}: ${starter} Request was missing a required field:`;
    break;
  case "INVALID_START_MODE":
    output = `${code}: ${starter} Invalid start mode provided.`;
    break;
  default:
    output = `${code}: ${starter}`;
  }
  // Append message to output if provided
  return message ? `${output} \n${message}` : output;
}
