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

const { validateReq } = require('../../middleware/reqValidator');
const Logger = require('../../modules/utils/Logger');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to put the watch status of a project with a particular projectWatchStateId
 * @param id the projectID
 * @param projectWatchStateId the projectWatchStateId for this status
 * @return 200 if operation success
 * @return 400 if with bad request
 * @return 500 if there was an error
 */
router.put('/api/v1/projects/:id/file-changes/:projectWatchStateId/status', validateReq, function (req, res) {
  try {
    const user = req.cw_user;
    const projectID = req.sanitizeParams('id');
    const success = req.sanitizeBody('success');
    const projectWatchStateId = req.sanitizeParams('projectWatchStateId');
    let status;
    if (success != undefined) {
      status = success ?  "success" : "failed";
    }
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
      return;
    }
    // ignore if the projectWatchStateId received does not match the latest projectWatchStateId set for this project
    if(project.projectWatchStateId == projectWatchStateId) {
      const data = {
        projectID: projectID,
        projectWatchStateId: projectWatchStateId,
        status: status
      };
      if (req.query && req.query.clientUuid) {
        data.clientUuid = req.query.clientUuid;
      }
      user.uiSocket.emit("projectWatchStatusChanged", data);
      log.info("Watch status for projectID " + data.projectID + ": " + data.status);
    }
    res.sendStatus(200);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

module.exports = router;
