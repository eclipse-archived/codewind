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

module.exports = class LoggingError extends BaseError {
  constructor(code = '[Unknown error code]', message) {
    super(code, constructMessage(code, message));
  }
}

// Error codes
module.exports.INVALID_LEVEL = "INVALID_LEVEL";
/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, message) {
  let output = "";
  switch (code) {
  case "INVALID_LEVEL":
    output = `Invalid logging level requested. It must be one of the following: error, warn, info, debug or trace`;
    break;
  default:
    output = `Logging error occurred.`;
  }
  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}
