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
'use strict';
const BaseError = require('./BaseError')

module.exports = class ProjectMetricsError extends BaseError {
  // Identifier can be either a project name or ID depending on the error message
  constructor(code = '[Unknown error code]', identifier, message) {
    super(code, constructMessage(code, identifier, message));
  }
}

// Error codes
module.exports.NOT_FOUND = 'NOT_FOUND';

/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param identifier, the name/path of the Project in question (based on the code being called)
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, identifier, message) {
  let output = '';
  switch(code) {
  case 'NOT_FOUND':
    output = `Unable to find metrics for project ${identifier}`;
    break;
  case 'DOCKER_CP':
    output = `Unable to perform docker cp for project ${identifier}`;
    break;
  case 'HCD_NOT_FOUND':
    output = `Unable to find .hcd saved in project ${identifier}`
    break;
  case 'PROFILING_NOT_FOUND':
    output = `Unable to find profiling.json saved in project ${identifier}`;
    break;
  case 'STREAM_FAILED':
    output = `Unable to create read stream for file ${identifier}`;
    break;
  default:
    output = `Unknown project metrics error`;
  }

  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}