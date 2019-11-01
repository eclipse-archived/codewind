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

const { validateReq } = require('../middleware/reqValidator');
const Logger = require('../modules/utils/Logger');
const { projectTypeToIgnoredPaths, dockerIgnoredPaths } = require('../modules/utils/ignoredPaths')

const log = new Logger(__filename);

/**
 * API Function to get ignoredPaths, for a particular projectType
 */
router.get('/api/v1/ignoredPaths', validateReq, function (req, res) {
  try {
    const projectType = req.sanitizeBody('projectType')
    log.debug(`Getting ignoredPaths for project of type  ${projectType}`);
    // default to docker if project unknown
    const ignoredPaths = projectTypeToIgnoredPaths[projectType] || dockerIgnoredPaths
    res.status(200).send(ignoredPaths);
  } catch (error) {
    log.error(error);
    res.status(500).send(error);
  }
});

module.exports = router;
