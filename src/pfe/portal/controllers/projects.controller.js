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
const Logger = require('../modules/utils/Logger');

const log = new Logger(__filename);

/**
 * Return a single project (as JSON)
 * @return the project object
 */
function getProject(req, res) {
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
}

/**
 * Return the project list (as JSON array)
 * @return the projectList
 */
function getProjects(req, res) {
  try {
    const user = req.cw_user;
    const list = user.projectList.getAsArray();
    res.status(200).send(list);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
}

module.exports = {
  getProject,
  getProjects,
}
