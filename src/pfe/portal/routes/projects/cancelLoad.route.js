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
const LoadRunError = require('../../modules/utils/errors/LoadRunError');

const router = express.Router();
const log = new Logger(__filename);

/**
* API function to cancel load against a given project
* @param req, the request from the UI containing project id
* @returns status code handled and passed back from the loadrunner
* 200 on success, 404 if project id does not exist,400 no load
* being run on that given project, 500 if error
*/
router.post('/api/v1/projects/:id/cancelLoad', async function(req,res){
  let user = req.mc_user;
  const projectID = req.sanitizeParams('id');
  let project = user.projectList.retrieveProject(projectID);

  if (!project) {
    res.status(404).send(`Unable to find project ${projectID}`);
  } else {
    try {
      let cancelLoadResp = await user.cancelLoad(project);
      // Response logic completed in ..docker/loadrunner/server.js
      res.status(cancelLoadResp.statusCode).send(cancelLoadResp.body);
    } catch(err) {
      log.error(err);
      if (err.code == LoadRunError.NO_RUN_IN_PROGRESS) {
        res.status(409).send(err.info);
      } else {
        res.status(500).send(err.info || err);
      }
    }
  }
});

module.exports = router;
