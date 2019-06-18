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

module.exports = class ImportError extends BaseError {
  constructor(code = '[Unknown error code]', message) {
    super(code, constructMessage(code, message));
  }
}

// Error codes
module.exports.NOT_FOUND = "NOT_FOUND";
module.exports.INVALID_INPUT = "INVALID_INPUT";
module.exports.AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED";
module.exports.AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED";
module.exports.AUTHENTICATION_TOKEN_ONLY = "AUTHENTICATION_TOKEN_ONLY";
module.exports.EXISTS = "EXISTS";
module.exports.REPOSITORY_NOT_FOUND = "REPOSITORY_NOT_FOUND";
module.exports.UNRECOGNISED_ERROR = "UNRECOGNISED_ERROR";

/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param msg, a message to be appended on the end of a default message
 */
function constructMessage(code, msg) {

  let message = msg;
  if(message.includes('@github')){
    //regex replacing username/password from repo url found in the error stack with '://'
    const regex = /:\/\/.*@/;
    message = message.replace(regex, '://');
  }

  let output = "";
  switch(code) {
  case "NOT_FOUND":
    output = `${code}: Error with request.`;
    break;
  case 'REPOSITORY_NOT_FOUND':
    output = `${code}: Error with requested repository.`;
    break;
  case 'INVALID_INPUT':
    output = `${code}: Invalid input has been given.`;
    break;
  case 'AUTHENTICATION_REQUIRED':
    output = `${code}: Request requires authentication.`;
    break;
  case 'AUTHENTICATION_FAILED':
    output = `${code}: Request authentication failed.`;
    break;
  case 'AUTHENTICATION_TOKEN_ONLY':
    output = `${code}: Request requires token only.`;
    break;
  case 'EXISTS':
    output = `${code}: Error with request.`;
    break;
  default:
    output = `${code}: Import failure.`;
  }

  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}
