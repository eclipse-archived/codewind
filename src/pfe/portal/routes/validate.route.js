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

const projectInitializer = require('../modules/projectInitializer');
const { validateReq } = require('../middleware/reqValidator');
const Logger = require('../modules/utils/Logger');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to validate whether a project on disk is able to be mounted by docker
 * @param req, the http request
 * @param path, the absolute path on the file system to the project
 * @return {res.code} 202 if local project is mountable
 * @return {res.code} 400 if local project path is of incorrect form
 * @return {res.code} 404 if local project is not found
 * @return {res.code} 500 if error
 */

router.post('/api/v1/validate', validateReq, async function (req, res) {
  try {
    const projectPath = req.sanitizeBody('projectPath');
    const projectInfo = await projectInitializer.initializeProjectFromLocalDir(projectPath);
    res.status(200).send(projectInfo);
  } catch (err) {
    log.error(err);
    if (err.code === "PATH_NOT_MOUNTABLE" || err.code === 'PATH_NOT_RESOLVED' || err.code === "PATH_NOT_ABSOLUTE") {
      res.status(400).send(err.info);
    } else {
      res.status(500).send(err.info || err);
    }
  }
});

module.exports = router;
