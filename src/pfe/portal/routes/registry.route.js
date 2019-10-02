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
const express = require('express');
const router = express.Router();
const Logger = require('../modules/utils/Logger');
const { validateReq } = require('../middleware/reqValidator');

const log = new Logger(__filename);

/**
 * API Function to get status of Deployment Registry in Workspace Settings
 */
router.get('/api/v1/registry', async function (req, res) {
  let retval;
  try {
    let user = req.cw_user;
    log.debug(`GET /api/v1/registry called`);
    retval = await user.getDeploymentRegistryStatus();
    res.status(retval.statusCode).send(retval);
  } catch (error) {
    log.error(error);
    const workspaceSettings = {
      statusCode: 500,
      deploymentRegistry: false
    }
    res.status(500).send(workspaceSettings);
  }
});

/**
 * API Function to test and set the Deployment Registry
 */
router.post('/api/v1/registry', validateReq, async function (req, res) {
  let retval;
  try {
    let user = req.cw_user;
    log.debug(`POST /api/v1/registry called`);
    const deploymentRegistry = req.sanitizeBody('deploymentRegistry');
    const operation = req.sanitizeBody('operation');
    if (!deploymentRegistry) {
      const msg = "Missing required parameter, deploymentRegistry is required to be provided.";
      const data = { "statusCode": 400, "deploymentRegistryTest": false, "msg": msg}
      res.status(400).send(data);
    }
    // The validateReq middleware will throw an error if operation is not test or set,
    // but it is optional and defaults to test.
    if (operation === undefined || operation === 'test') {
      log.debug(`Testing deployment registry: ${deploymentRegistry}`);
      retval = await user.testDeploymentRegistry(deploymentRegistry);
    } else if (operation === 'set') {
      log.debug(`Setting deployment registry: ${deploymentRegistry}`);
      retval = await user.writeWorkspaceSettings({deploymentRegistry});
    }
    res.status(retval.statusCode).send(retval);
  } catch (error) {
    log.error(error);
    const workspaceSettings = {
      statusCode: 500,
      deploymentRegistry: false
    }
    res.status(500).send(workspaceSettings);
  }
});

module.exports = router;
