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
const LoggingError = require('../modules/utils/errors/LoggingError');

const log = new Logger(__filename);

/**
 * API function to get logging levels
 * @return the current level, default level and an array of all logging levels available
 */
router.get('/api/v1/logging', async function (req, res) {
  try{
    const loggingLevels = await Logger.allLoggingLevels();
    res.status(200).send(loggingLevels);
  } catch(err){
    res.status(500).send(err);
  }
});

/**
 * API Function to set logging level
 */
router.put('/api/v1/logging', async function (req, res) {
  try {
    const level = req.sanitizeBody('level');
    await Logger.setLoggingLevel(level);
    log.info(`logging level set to ${level}`);
    res.sendStatus(200);
  } catch (err) {
    log.error(err);
    if (err instanceof LoggingError && err.code === 'INVALID_LEVEL') {
      res.status(400).send(err.message);
    }else {
      res.status(500).send(err.info || err);
    }
  }
});

module.exports = router;
