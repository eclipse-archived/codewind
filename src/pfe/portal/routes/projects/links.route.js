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
const { inspect: dockerInspect } = require('../../modules/utils/dockerFunctions');
const cwUtils = require('../../modules/utils/sharedFunctions');
const ProjectLinkError = require('../../modules/utils/errors/ProjectLinkError');

const log = new Logger(__filename);

router.get('/api/v1/projects/:id/links', validateReq, checkProjectExists, (req, res) => {
  try {
    const { links } = getProjectFromReq(req);
    res.status(200).send(links.getAll());
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

router.post('/api/v1/projects/:id/links', validateReq, checkProjectExists, async(req, res) => {
  // The targetProject is the one we want "this" project to be able to reach
  const targetProjectID = req.sanitizeBody('targetProjectID');
  const envName = req.sanitizeBody('envName');

  try {
    const { cw_user: user } = req;
    const project = getProjectFromReq(req);
    // TODO add logic to check remote project exists
    verifyTargetProjectExists(targetProjectID);
    const projectURL = new URL(`http://${process.env.HOSTNAME}:9090/links/proxy/${targetProjectID}`);

    const newLink = {
      projectID: targetProjectID,
      envName,
      projectURL,
    };

    await project.createLink(newLink);
    log.info(`New project link created for ${project.name}`);

    // Send status and then kick off the restart/rebuild
    const { links } = project;
    res.status(200).send(links.getAll());

    if (project.isOpen()) {
      await restartOrBuildProject(user, project);
    }
  } catch (err) {
    log.error(err);
    if (err.code === ProjectLinkError.CODES.INVALID_PARAMETERS) {
      res.sendStatus(400);
    } else if (err.code === ProjectLinkError.CODES.EXISTS) {
      res.sendStatus(409);
    } else {
      res.status(500).send(err);
    }
  }
});

router.put('/api/v1/projects/:id/links', validateReq, checkProjectExists, async(req, res) => {
  const currentEnvName = req.sanitizeBody('envName');
  const newEnvName = req.sanitizeBody('updatedEnvName');
  try {
    const { cw_user: user } = req;
    const project = getProjectFromReq(req);

    // If newEnvName or newProjectURL are not given through the API, default them to their old values
    const updatedLinkEnvName = (newEnvName) ? newEnvName : currentEnvName;
    await project.updateLink(currentEnvName, updatedLinkEnvName);

    // Send status and then kick off the restart/rebuild
    res.sendStatus(204);

    if (project.isOpen()) {
      await restartOrBuildProject(user, project);
    }
  } catch (err) {
    log.error(err);
    if (err.code === ProjectLinkError.CODES.NOT_FOUND) {
      res.sendStatus(404);
    } else {
      res.status(500).send(err);
    }
  }
});

router.delete('/api/v1/projects/:id/links', validateReq, checkProjectExists, async(req, res) => {
  const envNameOfLinkToDelete = req.sanitizeBody('envName');
  try {
    const { cw_user: user } = req;
    const project = getProjectFromReq(req);
    await project.deleteLink(envNameOfLinkToDelete);

    // Send status and then kick off the restart/rebuild
    res.sendStatus(204);

    if (project.isOpen()) {
      await restartOrBuildProject(user, project);
    }
  } catch (err) {
    log.error(err);
    if (err.code === ProjectLinkError.CODES.NOT_FOUND) {
      res.sendStatus(404);
    } else {
      res.status(500).send(err);
    }
  }
});

const verifyTargetProjectExists = async(user, projectID) => {
  const project = await user.projectList.retrieveProject(projectID);
  if (!project) {
    throw new Error('projectID not found on local PFE');
  }
  return project;
}

const restartOrBuildProject = async(user, project) => {
  const { projectType } = project;
  const projectTypesThatPickUpEnvsThroughRestart = ['nodejs', 'liberty', 'spring'];
  if (projectTypesThatPickUpEnvsThroughRestart.includes(projectType.toLowerCase())) {
    await restartNodeSpringLiberty(user, project);
  } else {
    await restartDocker(user, project);
  }
};

const restartNodeSpringLiberty = async(user, project) => {
  const { name, startMode, links } = project;
  const linksFileExists = await links.envFileExists();
  const projectRoot = cwUtils.getProjectSourceRoot(project);
  // TODO don't hard code '.codewind-project-links.env'
  const envFileName = '.codewind-project-links.env';
  if (linksFileExists) {
    await cwUtils.copyFile(project, links.getFilePath(), projectRoot, envFileName);
  } else {
    await cwUtils.deleteFile(project, projectRoot, envFileName);
  }
  log.info(`Restarting ${name} to pick up network environment variables`);
  const mode = (startMode) ? startMode : 'run';
  await user.restartProject(project, mode);
};

const restartDocker = async(user, project) => {
  const { name, buildStatus, projectID } = project;
  // As this function will be repeated until it has verified whether the envs exist in the container
  // we need to ensure that the project has not been deleted
  const projectExists = user.projectList.retrieveProject(projectID);
  if (!projectExists) {
    return;
  }

  let container;
  try {
    container = await dockerInspect(project);
  } catch (err) {
    const { statusCode } = err;
    // If container is not found keep waiting
    if (statusCode && statusCode === 404) {
      container = null;
    } else {
      throw err;
    }
  }

  if (buildStatus != "inProgress" && container) {
    const { Config: { Env: containerEnvs }} = container;
    const linksExistInContainer = await checkIfEnvsExistInArray(project, containerEnvs);
    // Only build and run the project if the links are not in the container
    if (!linksExistInContainer) {
      log.info(`Rebuilding ${name} to pick up network environment variables`);
      await user.buildAndRunProject(project);
    }
  } else {
    // if a build is in progress, wait 5 seconds and try again
    await cwUtils.timeout(5000);
    await restartDocker(user, project);
  }
};

const checkIfEnvsExistInArray = (project, array) => {
  const { links } = project;
  const envPairs = links.getEnvPairs();
  return envPairs.every(env => array.includes(env));
}

module.exports = router;
