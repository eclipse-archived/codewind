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

const log = new Logger(__filename);

/**
 * API Function to get status of Deployment Registry in Workspace Settings
 */
router.get('/api/v1/registry', function (req, res) {
  try {
    let user = req.mc_user;
    log.debug(`GET /api/v1/registry called`);
    user.getDeploymentRegistryStatus();

    res.sendStatus(200);
  } catch (error) {
    log.error(error);
    res.status(500).send(error);
  }
});

/**
 * API Function to test Deployment Registry
 */
router.post('/api/v1/registry', function (req, res) {
  try {
    let user = req.mc_user;
    log.debug(`POST /api/v1/registry called`);
    const deploymentRegistry = req.sanitizeBody('deploymentRegistry');
    if (!deploymentRegistry) {
        res.status(400).send("Missing required parameter, deploymentRegistry is required to be provided.");
        return;
    }
    log.debug(`Testing deployment registry: ${deploymentRegistry}`);
    user.testDeploymentRegistry(deploymentRegistry);

    res.sendStatus(200);
  } catch (error) {
    log.error(error);
    res.status(500).send(error);
  }
});

module.exports = router;
