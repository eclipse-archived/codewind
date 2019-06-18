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

const Logger = require('../../modules/utils/Logger');
const FilewatcherError = require('../../modules/utils/errors/FilewatcherError');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API function to return a list of the capabilities of the project, such as start modes and control commands
 * @return JSON object with the capabilities of the project listed
 */
router.get('/api/v1/projects/:id/capabilities', async (req, res) => {
  try {
    const user = req.mc_user;
    const projectID = req.sanitizeParams('id');
    const project = user.projectList.retrieveProject(projectID);
    if (project) {
      const capabilities = await user.projectCapabilities(project);
      res.status(200).send(capabilities);
    } else {
      res.status(404).send(`Unable to find project ${projectID}`);
    }
  } catch (err) {
    log.error(err);
    if (err instanceof FilewatcherError && err.code == "PROJECT_NOT_FOUND") {
      res.status(404).send(err.info);
    } else {
      res.status(500).send(err);
    }
  }
});

module.exports = router;
