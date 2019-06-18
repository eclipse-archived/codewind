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

module.exports = class ProjectListError extends BaseError {
  // Identifier can be either a project name or ID depending on the error message
  constructor(code = '[Unknown error code]', identifier, message) {
    super(code, constructMessage(code, identifier, message));
  }
}

// Error codes
module.exports.NOT_FOUND = "NOT_FOUND";
module.exports.ALREADY_EXISTS = "ALREADY_EXISTS";
module.exports.MALFORMED = "MALFORMED";

/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param identifier, the projectId or name of the Project in question (based on the code being called)
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, identifier, message) {
  let output = "";
  switch(code) {
  case "NOT_FOUND":
    output = `${code}: Project with ID ${identifier} not found.`;
    break;
  case 'ALREADY_EXISTS':
    output = `${code}: Project with name ${identifier} already exists.`;
    break;
  case 'MALFORMED':
    output = `${code}: Project is malformed.`;
    break;
  default:
    output = `${code}: Unknown project error Project ID is ${identifier}`;
  }
  
  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}
