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
const { validateReq } = require('../../middleware/reqValidator');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to restart a project
 * @param id, the id of the project
 * @return 200 if project existed and a valid action was requested
 * @return 400 if file-watcher request validation fails
 * @return 404 if project is not found
 * @return 500 on internal error
 */
router.post('/api/v1/projects/:id/restart', validateReq, async function (req, res) {
  try {
    const user = req.cw_user;
    const projectID = req.sanitizeParams('id');
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      const msg = `Unable to find project ${projectID}`;
      log.error(msg);
      res.status(404).send({ msg });
      return;
    }

    const startMode = req.sanitizeBody('startMode');
    await user.restartProject(project, startMode);
    res.sendStatus(202);
  } catch (err) {
    log.error(err);
    if (err instanceof FilewatcherError && err.code === "REQUEST_VALIDATION_ERROR") {
      res.status(400).send(err.info);
    } else {
      res.status(500).send(err.info || err);
    }
  }
});

module.exports = router;
