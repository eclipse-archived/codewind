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

module.exports = class MetricsStatusError extends BaseError {
  constructor(code = '[Unknown error code]', message) {
    super(code, constructMessage(code, message));
  }
}

// Error codes
module.exports.BUILD_FILE_MISSING = "BUILD_FILE_MISSING";
/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, message) {
  let output = "";
  switch (code) {
  case "BUILD_FILE_MISSING":
    output = ``;
    break;
  default:
    output = `Metrics status check error occurred.`;
  }
  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}