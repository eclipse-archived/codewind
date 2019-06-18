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
 * API Function to set locale
 */
router.post('/api/v1/locale', function (req, res) {
  try {
    let user = req.mc_user;
    log.debug(`Locale request is ${req.body}`);
    user.setLocale(req.body);
    res.sendStatus(200);
  } catch (error) {
    log.error(error);
    res.status(500).send(error);
  }
});

module.exports = router;
