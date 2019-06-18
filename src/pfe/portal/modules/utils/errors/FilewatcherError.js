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

module.exports = class FilewatcherError extends BaseError {
  // Identifier can be either a project name or ID depending on the error message
  constructor(code = '[Unknown error code]', identifier, message) {
    super(code, constructMessage(code, identifier, message));
  }
}

// Error codes
module.exports.CONNECTION_FAILED = "CONNECTION_FAILED";
module.exports.INTERNAL_ERROR = "INTERNAL_ERROR";
module.exports.NO_PROJECT_CAPABILITIES = "NO_PROJECT_CAPABILITIES";
module.exports.PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND";
module.exports.NO_PROJECT_TYPE_LIST = "NO_PROJECT_TYPE_LIST";
module.exports.NO_PROJECT_LOCATION = "NO_PROJECT_LOCATION";
module.exports.NO_PROJECT_LOG_LIST = "NO_PROJECT_LOG_LIST";
module.exports.FILE_WATCHER_INTERNAL_FAILURE = "FILE_WATCHER_INTERNAL_FAILURE";
module.exports.UNKNOWN_ERROR = "UNKNOWN_ERROR";
module.exports.REQUEST_VALIDATION_ERROR = "REQUEST_VALIDATION_ERROR";
module.exports.FILE_WATCHER_INTERNAL_FAILURE = "FILE_WATCHER_INTERNAL_FAILURE";

/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param identifier, the name of the Project ID or Filewatcher status code in question (based on the code being called)
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, identifier, message) {
  let output = "";
  switch(code) {
  case "CONNECTION_FAILED":
    output = `Internal error occurred, unable to process request.`;
    break;
  case "INTERNAL_ERROR":
    output = `Project ${identifier} internal error occurred.`;
    break;
  case "REQUEST_VALIDATION_ERROR":
    output = `Request error for project ${identifier}.`;
    break;
  case "FILE_WATCHER_INTERNAL_FAILURE":
    output = `Internal error occurred, status code: ${identifier}`;
    break;
  case 'NO_PROJECT_CAPABILITIES':
    output = `No project capabilities returned, status code: ${identifier}`;
    break;
  case 'PROJECT_NOT_FOUND':
    output = `Project ${identifier} not found, internal error occurred.`;
    break;
  case 'PROJECT_BUILD_FAILURE':
    output = `Project ${identifier} failed to build`;
    break;
  case 'NO_PROJECT_TYPE_LIST':
    output = `No project type list returned, status code: ${identifier}`;
    break;
  case 'NO_PROJECT_LOCATION':
    output = `Project location does not exist, status code: ${identifier}`;
    break;
  case 'UNKNOWN_ERROR':
    output = `Unknown response code received, status code: ${identifier}`;
    break;
  default:
    output = `Unknown error.`;
  }
  
  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}
