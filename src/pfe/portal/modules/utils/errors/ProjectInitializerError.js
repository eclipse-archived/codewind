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

const BaseError = require('./BaseError')

module.exports = class ProjectInitializerError extends BaseError {
  constructor(code = '[Unknown error code]', message) {
    super(code, constructMessage(code, message));
  }
}

module.exports.INVALID_PROJECT_NAME = "INVALID_PROJECT_NAME";
module.exports.BIND_FAILED = "BIND_FAILED"
module.exports.PATH_NOT_RESOLVED = "PATH_NOT_RESOLVED"
module.exports.PATH_NOT_ABSOLUTE = "PATH_NOT_ABSOLUTE"
module.exports.PATH_INVALID_TYPE = "PATH_INVALID_TYPE"
module.exports.PATH_NOT_MOUNTABLE = "PATH_NOT_MOUNTABLE"
module.exports.TEST_CONTAINER_FAILED = "TEST_CONTAINER_FAILED";
module.exports.TARGET_DIR_NOT_EMPTY = "TARGET_DIR_NOT_EMPTY";

function constructMessage(code, message) {
  let output = "";
  switch(code) {
  case "INVALID_PROJECT_NAME":
    output = `Project name is invalid:`;
    break;
  case "BIND_FAILED":
    output = `${code}: Project was unable to bind to container.`;
    break;
  case 'PATH_NOT_RESOLVED':
    output = `${code}: Project not found.`;
    break;
  case 'PATH_NOT_ABSOLUTE':
    output = `${code}: Path to project must be an absolute path.`;
    break;
  case 'PATH_NOT_MOUNTABLE':
    output = `${code}: Unable to docker mount project.`;
    break;
  case 'PATH_INVALID_TYPE':
    output = `${code}: Path to project must be a string.`;
    break;
  case 'TEST_CONTAINER_FAILED':
    output = `${code}:`;
    break;
  case 'TARGET_DIR_NOT_EMPTY':
    output = `${code}: directory in which to create project is not empty: `;
    break;

  default:
    output = `${code}: Project Binding Error`;
  }

  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}
