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

module.exports = class TemplateError extends BaseError {
  constructor(code = '[Unknown error code]', identifier, message) {
    super(code, constructMessage(code, identifier, message));
  }
}

// Error codes
module.exports.DUPLICATE_URL = 'DUPLICATE_URL';

// HTTP codes
module.exports.HTTP_LOCKED = 423;

/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param identifier, the name of the Project/Project path in question (based on the code being called)
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, identifier, message) {
  let output = '';
  switch(code) {
  case 'INVALID_URL':
    output = `Invalid URL: ${identifier}`;
    break;
  case 'DUPLICATE_URL':
    output = `URL ${identifier} is already a template repository`;
    break;
  case 'URL_DOES_NOT_POINT_TO_INDEX_JSON':
    output = `URL '${identifier}' does not point to a JSON file of the correct form`;
    break;
  case 'REPO_FILE_DOES_NOT_POINT_TO_INDEX_JSON':
    output = `repo file '${identifier}' does not point to a JSON file of the correct form`;
    break;
  case 'ADD_TO_PROVIDER_FAILURE':
    output = `A template provider failed to add the ${identifier} repository`;
    break;
  case 'GET_TEMPLATE_SUMMARIES_FAILED':
    output = `Get template summaries failed.`
    break;
  case 'REPOSITORY_DOES_NOT_EXIST':
    output = `${identifier} does not exist`;
    break;
  case 'LOCKED':
    output = `_lock is already set to true`;
    break;
  case 'NOT_LOCKED':
    // Shouldn't happen but this prevents against implementation errors
    output = `_lock is already set to false`;
    break;
  default:
    output = 'Unknown template error';
  }

  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}
