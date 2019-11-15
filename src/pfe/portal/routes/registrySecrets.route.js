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
// const { validateReq } = require('../middleware/reqValidator');

const log = new Logger(__filename);

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
router.post('/api/v1/registrysecrets', async function (req, res) {
  try {
    log.info("new api");
    let user = req.cw_user;
    log.info(`POST /api/v1/registrysecrets called`);
    const username = req.sanitizeBody('username');
    const password = req.sanitizeBody('password');
    const url = req.sanitizeBody('url');

    if (!username || !password || !url) {
      const msg = "Missing required parameters. username, password and url are required to be provided.";
      res.status(400).send(msg);
    }

    const retval = await user.setupRegistrySecret(username, password, url);
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
router.delete('/api/v1/registrysecrets', async function (req, res) {
  try {
    let user = req.cw_user;
    log.debug(`DELETE /api/v1/registrysecrets called`);
    const url = req.sanitizeBody('url');

    if (!url) {
      const msg = "Missing required parameters. url is required to be provided.";
      const data = { "statusCode": 400, "msg": msg}
      res.status(400).send(data);
    }

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