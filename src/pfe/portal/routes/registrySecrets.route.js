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
const { validateReq } = require('../middleware/reqValidator');

/**
 * API Function to get the Docker Registry
 */
router.get('/api/v1/registrysecrets', async function (req, res) {
  try {
    let user = req.cw_user;
    log.debug(`GET /api/v1/registrysecrets called`);
    const retval = await user.getRegistrySecretList();
    res.status(retval.statusCode).send(retval.body);
  } catch (error) {
    const msg = "Failed to get the Codewind Docker Config Registries";
    log.error(error);
    log.error(msg);
    res.status(500).send(msg);
  }
});

/**
 * API Function to set the Docker Registry
 */
router.post('/api/v1/registrysecrets', validateReq, async function (req, res) {
  try {
    let user = req.cw_user;
    log.debug(`POST /api/v1/registrysecrets called`);
    const credentials = req.sanitizeBody('credentials');
    const url = req.sanitizeBody('url');

    const retval = await user.setupRegistrySecret(credentials, url);
    res.status(retval.statusCode).send(retval.body);
  } catch (error) {
    const msg = "Failed to set up the Codewind Registry Secret";
    log.error(error);
    log.error(msg);
    res.status(500).send(msg);
  }
});

/**
 * API Function to delete the Docker Registry
 */
router.delete('/api/v1/registrysecrets', validateReq, async function (req, res) {
  try {
    let user = req.cw_user;
    log.debug(`DELETE /api/v1/registrysecrets called`);
    const url = req.sanitizeBody('url');

    const retval = await user.removeRegistrySecret(url);
    res.status(retval.statusCode).send(retval.body);
  } catch (error) {
    const msg = "Failed to delete the Codewind Registry Secret";
    log.error(error);
    log.error(msg);
    res.status(500).send(msg);
  }
});
  
module.exports = router;