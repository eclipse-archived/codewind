/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/

const express = require('express');
const router = express.Router();

const Logger = require('../../modules/utils/Logger');
const { validateReq } = require('../../middleware/reqValidator');
const { checkProjectExists, getProjectFromReq } = require('../../middleware/checkProjectExists');
const { verifyTargetProjectExists, getProjectURL, handleProjectRestartAndSocketEmit } = require('../../services/links.service');
const ProjectLinkError = require('../../modules/utils/errors/ProjectLinkError');

const log = new Logger(__filename);

router.get('/api/v1/projects/:id/links', validateReq, checkProjectExists, (req, res) => {
  try {
    const { links } = getProjectFromReq(req);
    res.status(200).send(links.getAll());
  } catch (err) {
    handleHttpError(err, res);
  }
});

router.post('/api/v1/projects/:id/links', validateReq, checkProjectExists, async(req, res) => {
  // The targetProject is the one we want "this" project to be able to reach
  const targetProjectID = req.sanitizeBody('targetProjectID');
  const envName = req.sanitizeBody('envName');

  const { cw_user: user } = req;
  const project = getProjectFromReq(req);
  try {
    const targetProject = verifyTargetProjectExists(user, targetProjectID);

    const projectURL = await getProjectURL(targetProject);

    const newLink = {
      projectID: targetProjectID,
      projectName: targetProject.name,
      envName,
      projectURL,
    };
    await project.createLink(newLink);
    log.info(`New project link created for ${project.name}`);

    // Send status, emit projectChanged and then kick off the restart/rebuild
    res.sendStatus(202);

    // Restart the project, from here we only use Socket events if there is an error
    await handleProjectRestartAndSocketEmit(user, project, newLink, false);
  } catch (err) {
    handleHttpError(err, res);
  }
});

router.put('/api/v1/projects/:id/links', validateReq, checkProjectExists, async(req, res) => {
  const currentEnvName = req.sanitizeBody('envName');
  const newEnvName = req.sanitizeBody('updatedEnvName');
  const { cw_user: user } = req;
  const project = getProjectFromReq(req);
  const { links } = project;
  try {
    // If newEnvName are not given through the API, default them to their old values
    const updatedLinkEnvName = (newEnvName) ? newEnvName : currentEnvName;
    await project.updateLink(currentEnvName, updatedLinkEnvName);
    const updatedLink = links.get(updatedLinkEnvName);

    // Send status, emit projectChanged and then kick off the restart/rebuild
    res.sendStatus(202);

    // Restart the project, from here we only use Socket events if there is an error
    await handleProjectRestartAndSocketEmit(user, project, updatedLink, false);
  } catch (err) {
    handleHttpError(err, res);
  }
});

router.delete('/api/v1/projects/:id/links', validateReq, checkProjectExists, async(req, res) => {
  const envNameOfLinkToDelete = req.sanitizeBody('envName');
  const { cw_user: user } = req;
  const project = getProjectFromReq(req);
  const { links } = project;
  try {
    const linkToDelete = links.get(envNameOfLinkToDelete);
    await project.deleteLink(envNameOfLinkToDelete);

    // Send status
    res.sendStatus(202);

    // Restart the project, from here we only use Socket events if there is an error
    await handleProjectRestartAndSocketEmit(user, project, linkToDelete, true);
  } catch (err) {
    handleHttpError(err, res);
  }
});

function handleHttpError(err, res) {
  log.error(err);
  switch(err.code) {
  case ProjectLinkError.CODES.INVALID_PARAMETERS:
    res.status(400).send(err.info || err);
    break;
  case ProjectLinkError.CODES.NOT_FOUND:
  case ProjectLinkError.CODES.TARGET_PROJECT_NOT_FOUND:
  case ProjectLinkError.CODES.CONTAINER_NOT_FOUND:
  case ProjectLinkError.CODES.SERVICE_NOT_FOUND:
  case ProjectLinkError.CODES.CONFIG_MAP_NOT_FOUND:
  case ProjectLinkError.CODES.DEPLOYMENT_NOT_FOUND:
    res.status(404).send(err.info || err);
    break;
  case ProjectLinkError.CODES.EXISTS:
    res.status(409).send(err.info || err);
    break;
  default:
    res.status(500).send(err);
  }
}

module.exports = router;
