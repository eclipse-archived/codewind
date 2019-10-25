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
const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to get the a single project and return it as a json object
 * @return the project object
 */
router.get('/api/v1/projects/:id', (req, res) => {
  try {
    let projectID = req.sanitizeParams('id');
    let user = req.cw_user;
    let project = user.projectList.retrieveProject(projectID);
    if (project) {
      res.status(200).send(project);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

/**
 * API Function to get the projectList and return it as an array
 * @return the projectList
 */
router.get('/api/v1/projects', (req, res) => {
  try {
    const user = req.cw_user;
    const list = user.projectList.getAsArray();
    res.status(200).send(list);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

module.exports = router;
