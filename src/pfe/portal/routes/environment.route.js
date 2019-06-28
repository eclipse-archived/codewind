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

const Logger = require('../modules/utils/Logger');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to provide codewind runtime information to the UI
 */
router.get('/api/v1/environment', (req, res) => {
  try {
    let body = {};
    body = {
      running_on_icp: global.codewind.RUNNING_IN_K8S,
      user_string: req.cw_user.userString,
      socket_namespace: req.cw_user.uiSocketNamespace,
      codewind_version: process.env.CODEWIND_VERSION,
      workspace_location: process.env.HOST_WORKSPACE_DIRECTORY,
      os_platform: process.env.HOST_OS || 'Linux',
    }
    res.status(200).send(body);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

module.exports = router;
