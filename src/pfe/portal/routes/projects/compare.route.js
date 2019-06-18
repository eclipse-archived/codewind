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
const ProjectError = require('../../modules/utils/errors/ProjectError');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to return a comparison between the two most recent load-test runs (set of metric deltas) for a specified project
 * @param project, the project
 * @return set of metric deltas
 */
router.get('/api/v1/projects/:id/compare', async function (req, res) {
  let projectID = req.sanitizeParams('id');
  try {
    let user = req.mc_user;
    let project = user.projectList.retrieveProject(projectID);
    if (project) {
      let comparison = await project.getComparison();
      res.status(200).send(comparison).end();
    } else {
      log.error("portal/server.js: error in metrics request: project " + projectID + " does not exist");
      res.status(404).send(`Unknown project ${projectID}`);
    }
  } catch (err) {
    log.error(err);
    if (err instanceof ProjectError && err.code == 'NOT_FOUND') {
      res.status(404).send(err.info);
    } else if (err instanceof ProjectError && (err.code == 'NOT_ENOUGH_SNAPSHOTS' || err.code == 'LOAD_TEST_DIR_ERROR')) {
      res.status(422).send(err.info);
    } else {
      res.status(500).send(err.info || err);
    }
  }
});

module.exports = router;
