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
 * Temp API Function to bypass current IDE design for testing
 */
router.get('/api/v1/registry', function (req, res) {
  let retval;
  try {
    // let user = req.cw_user;
    log.debug(`GET /api/v1/imagepushregistry called`);
    retval = {
      deploymentRegistry: true
    }
    res.status(200).send(retval);
  } catch (error) {
    log.error(error);
    const workspaceSettings = {
      imagePushRegistry: false
    }
    res.status(500).send(workspaceSettings);
  }
});

/**
 * API Function to get status of Deployment Registry in Workspace Settings
 */
router.get('/api/v1/imagepushregistry', async function (req, res) {
  let retval;
  try {
    let user = req.cw_user;
    log.debug(`GET /api/v1/imagepushregistry called`);
    retval = await user.getImagePushRegistryStatus();
    res.status(200).send(retval);
  } catch (error) {
    log.error(error);
    const workspaceSettings = {
      imagePushRegistry: false
    }
    res.status(500).send(workspaceSettings);
  }
});

/**
 * API Function to test and set the Deployment Registry
 */
router.post('/api/v1/imagepushregistry', validateReq, async function (req, res) {
  let retval;
  try {
    let user = req.cw_user;
    log.debug(`POST /api/v1/imagepushregistry called`);
    const address = req.sanitizeBody('address');
    const namespace = req.sanitizeBody('namespace');
    const operation = req.sanitizeBody('operation');

    // The validateReq middleware will throw an error if operation is not test or set,
    // but it is optional and defaults to test.
    if (operation === undefined || operation === 'test') {
      log.debug(`Testing image push registry: ${address}/${namespace}`);
      retval = await user.testImagePushRegistry(address, namespace);
    } else if (operation === 'set') {
      log.debug(`Setting image push registry: ${address}/${namespace}`);
      retval = await user.writeWorkspaceSettings({address, namespace});
    }
    res.status(retval.statusCode).send(retval);
  } catch (error) {
    log.error(error);
    const workspaceSettings = {
      statusCode: 500,
      imagePushRegistryTest: false,
      msg: error.message
    }
    res.status(500).send(workspaceSettings);
  }
});

module.exports = router;
