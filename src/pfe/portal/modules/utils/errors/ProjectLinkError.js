/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
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

class ProjectLinkError extends BaseError {
  // Identifier can be either a project name or ID depending on the error message
  constructor(code = '[Unknown error code]', identifier, message) {
    super(code, constructMessage(code, identifier, message));
  }
}

ProjectLinkError.CODES = {
  NOT_FOUND: 'NOT_FOUND',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  EXISTS: 'EXISTS',
  TARGET_PROJECT_NOT_FOUND: 'TARGET_PROJECT_NOT_FOUND',
  CONTAINER_NOT_FOUND: 'CONTAINER_NOT_FOUND',
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  CONFIG_MAP_NOT_FOUND: 'CONFIG_MAP_NOT_FOUND',
  DEPLOYMENT_NOT_FOUND: 'DEPLOYMENT_NOT_FOUND',
}

/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param identifier, the name/path of the Project in question (based on the code being called)
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, identifier, message) {
  let output = '';
  switch(code) {
  case ProjectLinkError.CODES.NOT_FOUND:
    output = `Unable to find link: ${identifier}`;
    break;
  case ProjectLinkError.CODES.INVALID_PARAMETERS:
    output = `Invalid parameters given for link: ${identifier}`;
    break;
  case ProjectLinkError.CODES.EXISTS:
    output = `The envName '${identifier}' already exists as a link`;
    break;
  case ProjectLinkError.CODES.TARGET_PROJECT_NOT_FOUND:
    output = `The target project '${identifier}' cannot be found on the Codewind server`;
    break;
  case ProjectLinkError.CODES.CONTAINER_NOT_FOUND:
    output = `The container for project '${identifier}' cannot be found`;
    break;
  case ProjectLinkError.CODES.SERVICE_NOT_FOUND:
    output = `The service for project '${identifier}' cannot be found`;
    break;
  case ProjectLinkError.CODES.CONFIG_MAP_NOT_FOUND:
    output = `The configmap for project '${identifier}' cannot be found`;
    break;
  case ProjectLinkError.CODES.DEPLOYMENT_NOT_FOUND:
    output = `The deployment for project '${identifier}' cannot be found`;
    break;
  default:
    output = `Unknown project link error`;
  }

  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}

module.exports = ProjectLinkError;
