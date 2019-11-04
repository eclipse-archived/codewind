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
 * API Function to test and set the Deployment Registry
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
      const data = { "statusCode": 400, "msg": msg}
      res.status(400).send(data);
    }

    await user.setupDockerRegistry(username, password, url);

    const data = { "statusCode": 200, "msg": "set"}
    res.status(200).send(data);
  } catch (error) {
    log.error(error);
  }
});
  
module.exports = router;