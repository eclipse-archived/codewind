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

module.exports = class RegistrySecretsError extends BaseError {
  constructor(code = '[Unknown error code]', message) {
    super(code, constructMessage(code, message));
  }
}

// Error codes
module.exports.INVALID_ENCODED_CREDENTIALS = "INVALID_ENCODED_CREDENTIALS";
module.exports.REGISTRY_DUPLICATE_URL = "REGISTRY_DUPLICATE_URL";
module.exports.SECRET_CREATE_FAILED = "SECRET_CREATE_FAILED";
module.exports.SERVICE_ACCOUNT_PATCH_FAILED = "SERVICE_ACCOUNT_PATCH_FAILED";
module.exports.NO_DOCKER_CONFIG = "NO_DOCKER_CONFIG";
module.exports.SECRET_DELETE_MISSING = "SECRET_DELETE_MISSING";

/**
 * Function to construct an error message based on the given error code
 * @param code, the error code to create the message from
 * @param message, a message to be appended on the end of a default message
 */
function constructMessage(code, message) {
  let output = "";
  switch (code) {
  case "INVALID_ENCODED_CREDENTIALS":
    output = `Encoded credentials object does not have either username or password`;
    break;
  case "REGISTRY_DUPLICATE_URL":
    output = `Cannot have multiple docker registries with the same url. Please delete the previous registry and try again`;
    break;
  case "SECRET_CREATE_FAILED":
    output = `Failed to create the Codewind Secret`;
    break;
  case "SERVICE_ACCOUNT_PATCH_FAILED":
    output = `Failed to patch the Service Account`;
    break;
  case "NO_DOCKER_CONFIG":
    output = `Unable to find the Codewind Docker Config`;
    break;
  case "SECRET_DELETE_MISSING":
    output = `Unable to find the registry secret to delete`;
    break;
  default:
    output = `Registry Secrets API error occurred`;
  }
  // Append message to output if provided
  return message ? `${output}\n${message}` : output;
}
