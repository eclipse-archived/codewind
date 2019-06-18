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

module.exports = class UserListError extends BaseError {
  // userID can be either a project name or ID depending on the error message
  constructor(code = '[Unknown error code]', userID, message) {
    super(code, constructMessage(code, userID, message));
  }
}

// Error codes
module.exports.USER_NOT_FOUND = "USER_NOT_FOUND";
module.exports.ALREADY_EXISTS = "ALREADY_EXISTS";
module.exports.TOO_MANY_USERS = "TOO_MANY_USERS";


/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param userID, the ID of the user in question
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, userID, message) {
  let output = "";
  switch(code) {
  case "USER_NOT_FOUND":
    output = `${code}: User with ID '${userID}' not found.`;
    break;
  case 'ALREADY_EXISTS':
    output = `${code}: User with ID '${userID}' already exists.`;
    break;
  case 'TOO_MANY_USERS':
    output = `${code} Attempted to add an additional user (${userID}) while running in single user mode`
    break;
  default:
    output = `${code}: Unknown user error.` + (userID ? ` UserID is ${userID}` : '');
  }
  
  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}

