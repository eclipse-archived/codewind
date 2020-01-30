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

const Project = require('../../modules/Project');
const Logger = require('../../modules/utils/Logger');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to close a given project
 * @param id, the id of the project to close
 * @return 200 if project was successfully closed
 * @return 404 if project is not found
 */
router.put('/api/v1/projects/:id/close', async function (req, res) {
  const user = req.cw_user;
  const id = req.sanitizeParams('id');
  try {
    const project = user.projectList.retrieveProject(id);

    // client error cases
    if (!project) {
      const msg = `Unable to find project ${id}`;
      log.error(msg);
      res.status(404).send({ msg });
      return;
    }
    const projectDetails = `project ${project.name} (${id})`;
    if (project.isClosing() || project.isClosed()) {
      const msg = (project.isClosing() ? `Already closing ${projectDetails}` : `${projectDetails} is already closed`);
      log.error(msg);
      res.status(409).send({ msg });
      return;
    }

    // success case
    await user.projectList.updateProject({
      projectID: id,
      action: Project.STATES.closing
    });
    const msg = `Now trying to close ${projectDetails}`;
    log.debug(msg);
    res.status(202).send({ msg });
    await user.closeProject(project);

  } catch (err) {
    const data = {
      projectID: id,
      status: 'failed',
      error: err.message,
    }
    user.uiSocket.emit('projectClosed', data);
    log.error(data);
  }
});

module.exports = router;
