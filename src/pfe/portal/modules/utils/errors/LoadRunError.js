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

module.exports = class LoadRunError extends BaseError {
  constructor(code = '[Unknown error code]', message) {
    super(code, constructMessage(code, message));
  }
}

// Error codes
module.exports.PROJECT_NOT_OPEN = "PROJECT_NOT_OPEN";
module.exports.RESULTS_DIR_FAILED = "RESULTS_DIR_FAILED";
module.exports.RUN_IN_PROGRESS = "RUN_IN_PROGRESS";
module.exports.NO_RUN_IN_PROGRESS = "NO_RUN_IN_PROGRESS";
module.exports.CONNECTION_FAILED = "CONNECTION_FAILED";
/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, message) {
  let output = "";
  switch (code) {
  case "PROJECT_NOT_OPEN":
    output = `Unable to run load against project. Project is not open.`;
    break;
  case "RESULTS_DIR_FAILED":
    output = `Unable to create results directory.`;
    break;
  case "RUN_IN_PROGRESS":
    output = `Load run already in progress.`;
    break;
  case "NO_RUN_IN_PROGRESS":
    output = `Unable to cancel, no load run in progress.`;
    break;
  case "CONNECTION_FAILED":
    output = `Load Runner service is not available.`;
    break;
  default:
    output = `Load run error occurred.`;
  }
  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}
