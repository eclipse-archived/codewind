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
 * API Function to build or enable/disable autobuild on a project.
 * @param id, the id of the project
 * @return 200 if project existed and a valid action was requested.
 * @return 400 if project is not found
 * @return 500 on internal error
 */
router.post('/api/v1/projects/:id/build', validateReq, buildProject);

async function buildProject(req, res) {
  try {
    const id = req.sanitizeParams('id');
    const user = req.cw_user;
    const project = user.projectList.retrieveProject(id);
    const action = req.sanitizeBody('action');
    if (!project) {
      res.status(404).send(`Unable to find project ${id}`);
      return;
    }
    
    if (project.isClosed() || project.isClosing() || project.isDeleting()) {
      const msg = `Cannot perform build action ${action} on ${project.name} because it is in state ${project.state}.`;
      res.status(400).send(msg);
      log.error(msg);
      return;
    }

    if (!project.loadRunner.isIdle()) {
      const msg = `Cannot perform build action ${action} on ${project.name} because there is a load run in progress.`;
      res.status(400).send(msg);
      log.error(msg);
      return;
    }
    
    res.status(202).send(`Trying to build project ${id} with action ${action}`);
    await user.buildProject(project, action);
    
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
}

module.exports = router;
