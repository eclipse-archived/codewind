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
const RegistrySecretsError = require('../modules/utils/errors/RegistrySecretsError');
const log = new Logger(__filename);
const { validateReq } = require('../middleware/reqValidator');

/**
 * API Function to get the Docker Registry
 */
router.get('/api/v1/registrysecrets', async function (req, res) {
  try {
    let user = req.cw_user;
    log.debug(`GET /api/v1/registrysecrets called`);
    const registrySecretList = await user.getRegistrySecretList();
    res.status(200).send(registrySecretList);
  } catch (err) {
    log.error(err);
    res.status(500).send(err.message);
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
    const address = req.sanitizeBody('address');

    const registrySecretList = await user.setupRegistrySecret(credentials, address);
    res.status(201).send(registrySecretList);
  } catch (err) {
    log.error(err);
    if (err.code == RegistrySecretsError.INVALID_ENCODED_CREDENTIALS || err.code == RegistrySecretsError.REGISTRY_DUPLICATE_URL) {
      res.status(400).send(err.info.message);
    } else {
      res.status(500).send(err.info.message || err.message);
    }
  }
});

/**
 * API Function to delete the Docker Registry
 */
router.delete('/api/v1/registrysecrets', validateReq, async function (req, res) {
  try {
    let user = req.cw_user;
    log.debug(`DELETE /api/v1/registrysecrets called`);
    const address = req.sanitizeBody('address');

    const registrySecretList = await user.removeRegistrySecret(address);
    res.status(200).send(registrySecretList);
  } catch (err) {
    log.error(err);
    if (err.code == RegistrySecretsError.SECRET_DELETE_MISSING || err.code == RegistrySecretsError.NO_DOCKER_CONFIG) {
      res.status(400).send(err.info.message);
    } else {
      res.status(500).send(err.info.message || err.message);
    }
  }
});
  
module.exports = router;