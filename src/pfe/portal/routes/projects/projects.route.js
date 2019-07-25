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
const path = require('path');

const projectInitializer = require('../../modules/projectInitializer');
const ProjectInitializerError = require('../../modules/utils/errors/ProjectInitializerError');
const Logger = require('../../modules/utils/Logger');
const { validateReq } = require('../../middleware/reqValidator');
const { ILLEGAL_PROJECT_NAME_CHARS } = require('../../config/requestConfig');
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

/**
 * API Function to add new code from a template
 * @param parentDir the absolute path on the file system in which to clone the project
 * @param projectName the project name to create
 * @return 200 if the creation request is accepted
 * @return 400 if a parameter is invalid
 * @return 404 if template isn't found
 * @return 500 if there was an error
 */
router.post('/api/v1/projects', validateReq, async function (req, res) {

  try {
    const user = req.cw_user;
    const parentPath = req.sanitizeBody('parentPath');
    const projectName = req.sanitizeBody('projectName');
    const url = req.sanitizeBody('url');
    const illegalNameChars = ILLEGAL_PROJECT_NAME_CHARS.filter(char => projectName.includes(char));
    if (illegalNameChars.length > 0) {
      throw new ProjectInitializerError('INVALID_PROJECT_NAME', `invalid characters : ${JSON.stringify(illegalNameChars)}`);
    }
    log.info(`template to use is ${url}`);
    const projectPath = path.join(parentPath, projectName);
    const gitInfo = {
      repo: url,
      branch: "master"
    }
    log.info(`Trying to clone ${gitInfo.repo} into ${projectPath}`);
    const projectInfo = await projectInitializer.initializeProjectFromTemplate(user, projectPath, projectName, gitInfo);
    let returnCode = 200;
    // If the initialize container failed, set the status code to 400
    if (projectInfo.status === 'failed') {
      returnCode = 400;
    }
    res.status(returnCode).send(projectInfo);
  } catch (err) {
    log.error(err);
    if (err.code === 'PATH_NOT_RESOLVED'
      || err.code === 'PATH_NOT_ABSOLUTE'
      || err.code === 'PATH_NOT_MOUNTABLE'
      || err.code === 'TARGET_DIR_NOT_EMPTY'
      || err.code === 'INVALID_PROJECT_NAME') {
      res.status(400).send(err.info);
    } else {
      res.status(500).send(err.message || err.info || err);
    }
  }
});

module.exports = router;
