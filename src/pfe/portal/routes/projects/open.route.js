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
 * API Function to open a given project
 * @param id, the id of the project to open
 * @return 200 if project was successfully opened
 * @return 404 if project is not found
 */
router.put('/api/v1/projects/:id/open', openProject);

async function openProject(req, res) {
  try {
    const user = req.cw_user;
    const id = req.sanitizeParams('id');
    const project = user.projectList.retrieveProject(id);
    if (!project) {
      const msg = `Unable to find project ${id}`;
      log.error(msg);
      res.status(404).send(msg);
    } else {
      let updatedProject = {
        projectID: id,
        state: Project.STATES.open,
        startMode: 'run' // always use 'run' mode for new or recently re-opened projects
      }
      updatedProject = await user.projectList.updateProject(updatedProject);
      const msg = `Project ${project.name} (${id}) opened. Will now build and run it`;
      log.debug(msg);
      res.status(200).send(msg);
      await user.buildAndRunProject(updatedProject);
    }
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
}

module.exports = router;
