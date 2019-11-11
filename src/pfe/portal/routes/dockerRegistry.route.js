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
router.get('/api/v1/dockerregistry', async function (req, res) {
  let retval;
  try {
    let user = req.cw_user;
    log.debug(`GET /api/v1/dockerregistry called`);
    retval = await user.getDockerRegistryList();
    res.status(200).send(retval);
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
 * API Function to set the Docker Registry
 */
router.post('/api/v1/dockerregistry', async function (req, res) {
  try {
    log.info("new api");
    let user = req.cw_user;
    log.info(`POST /api/v1/dockerregistry called`);
    const username = req.sanitizeBody('username');
    const password = req.sanitizeBody('password');
    const url = req.sanitizeBody('url');

    if (!username || !password || !url) {
      const msg = "Missing required parameters. username, password and url are required to be provided.";
      res.status(400).send(msg);
    }

    await user.setupDockerRegistry(username, password, url);
    const msg = "POST /api/v1/dockerregistry has updated the Docker config and patched the Service Account";
    res.status(200).send(msg);
  } catch (error) {
    log.error(error);
  }
});

/**
 * API Function to delete the Docker Registry
 */
router.delete('/api/v1/dockerregistry', async function (req, res) {
  let retval = {};
  try {
    let user = req.cw_user;
    log.debug(`DELETE /api/v1/dockerregistry called`);
    const url = req.sanitizeBody('url');

    if (!url) {
      const msg = "Missing required parameters. url is required to be provided.";
      const data = { "statusCode": 400, "msg": msg}
      res.status(400).send(data);
    }

    retval = await user.removeDockerRegistry(url);
    res.status(200).send(retval);
  } catch (error) {
    log.error(error);
    retval = {};
    res.status(500).send(retval);
  }
});
  
module.exports = router;