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
const { OpenApiValidator } = require('express-openapi-validate');
const YAML = require('yamljs');
const path = require('path');

const pathToDocsDir = path.join(__dirname, '../docs');
const openApiDocument = YAML.load(path.join(pathToDocsDir, 'openapi.yml'));

const validator = new OpenApiValidator(openApiDocument);

function validateReq(req, res, next) {
  const pathInOpenapiFormat = req.baseUrl + getRouteInOpenapiFormat(req);
  const methodInOpenapiFormat = req.method.toLowerCase();
  const validationFunction = validator.validate(methodInOpenapiFormat, pathInOpenapiFormat);
  validationFunction(req, res, next);
}

function getRouteInOpenapiFormat(req) {
  let openApiPath = req.route.path
    .replace(/:([a-zA-Z]+)/g, '{$1}');
  return openApiPath;
}

module.exports = {
  validateReq,
  openApiDocument,
};