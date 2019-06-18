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

module.exports = class ExtensionListError extends BaseError {
  constructor(code = '[Unknown error code]', identifier, message) {
    super(code, constructMessage(code, identifier, message));
  }
}

// Error codes
module.exports.NOT_FOUND = "NOT_FOUND";
module.exports.FAILED_TO_LOAD = "FAILED_TO_LOAD";
module.exports.EXISTS = "EXISTS";

/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param identifier, the extension name in question (based on the code being called)
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, identifier, message) {

  let output = "";
  switch(code) {
  case "NOT_FOUND":
    output = `${code}: Extension ${identifier} not found`;
    break;
  case "FAILED_TO_LOAD":
    output = `${code}: Failed to load extensions`;
    break;
  case 'EXISTS':
    output = `${code}: Extension ${identifier} already exists.`;
    break;
  default:
    output = `${code}: Error with request.`;
  }

  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}
