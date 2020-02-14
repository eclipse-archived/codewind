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

module.exports = class ProjectError extends BaseError {
  // Identifier can be either a project name or ID depending on the error message
  constructor(code = '[Unknown error code]', identifier, message) {
    super(code, constructMessage(code, identifier, message));
  }
}

// Error codes
module.exports.INVALID_METRIC_TYPE = "INVALID_METRIC_TYPE";
module.exports.NOT_FOUND = "NOT_FOUND";
module.exports.LOAD_TEST_DIR_ERROR = "LOAD_TEST_DIR_ERROR";
module.exports.LOCK_FAILURE = "LOCK_FAILURE";
module.exports.NOT_ENOUGH_SNAPSHOTS = "NOT_ENOUGH_SNAPSHOTS";
module.exports.INVALID_VALIDATION = "INVALID_VALIDATION";
module.exports.INVALID_CREATION_OPTIONS = "INVALID_CREATION_OPTIONS";
module.exports.DELETE_ERROR = "DELETE_ERROR";


/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param identifier, the name of the Project/Project path in question (based on the code being called)
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, identifier, message) {
  let output = "";
  switch(code) {
  case "INVALID_METRIC_TYPE":
    output = `${identifier} is not a valid metric type. Valid metric types are`;
    break;
  case "NOT_FOUND":
    output = `httpUrls data not found in metrics file`;
    break;
  case 'LOAD_TEST_DIR_ERROR':
    output = `Failed to read load-test directories`;
    break;
  case 'LOCK_FAILURE':
    output = `Unable to obtain lock on project.inf file for project ${identifier}.`;
    break;
  case 'NOT_ENOUGH_SNAPSHOTS':
    output = `Unable to find two snapshots for project ${identifier}`;
    break;
  case 'INVALID_VALIDATION':
    output = `Invalid validation request from project ID ${identifier}`;
    break;
  case 'INVALID_CREATION_OPTIONS':
    output = `Invalid creation options`;
    break;
  case 'DELETE_ERROR':
    output = `Unable to remove project directory ${identifier}`;
    break;
  default:
    output = `Unknown project error`;
  }

  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}
