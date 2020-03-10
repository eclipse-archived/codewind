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
const { TYPES } = require('../../modules/project/Links');
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
  const targetProjectURL = req.sanitizeBody('targetProjectURL');
  const targetProjectPFEURL = req.sanitizeBody('targetProjectPFEURL');

  try {
    const { cw_user: user } = req;
    const project = getProjectFromReq(req);
    const newLink = {
      projectID: targetProjectID,
      envName,
      projectURL: targetProjectURL,
      parentPFEURL: targetProjectPFEURL,
      type: TYPES.REMOTE,
    };

    // Check to see if the project exists on this PFE instance
    if (!targetProjectURL && !targetProjectPFEURL) {
      // Get the url from the projectList, throw an error if the project does not exist
      const localProjectURL = await verifyProjectExistsAndReturnInternalURL(user, targetProjectID);
      newLink.projectURL = localProjectURL;
      newLink.type = TYPES.LOCAL;
    }

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
  let newProjectURL = req.sanitizeBody('targetProjectURL');
  try {
    const { cw_user: user } = req;
    const project = getProjectFromReq(req);
    const { links } = project;

    // If the link on the same PFE (local) fetch the projectURL from the ProjectList (ignore newProjectURL)
    const { type: linkType, projectID: targetProjectID, projectURL: currentProjectURL } = links.get(currentEnvName);
    
    if (linkType === TYPES.LOCAL) {
      // Get the url from the projectList, throw an error if the project does not exist
      const localProjectURL = await verifyProjectExistsAndReturnInternalURL(user, targetProjectID);
      newProjectURL = localProjectURL;
    }

    // If newEnvName or newProjectURL are not given through the API, default them to their old values
    const updatedLinkEnvName = (newEnvName) ? newEnvName : currentEnvName;
    const updatedLinkProjectURL = (newProjectURL) ? newProjectURL : currentProjectURL;
    await project.updateLink(currentEnvName, updatedLinkEnvName, updatedLinkProjectURL);

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

const verifyProjectExistsAndReturnInternalURL = async(user, projectID) => {
  const project = await user.projectList.retrieveProject(projectID);
  if (!project) {
    throw new Error('projectID not found on local PFE');
  }
  const { host: dockerNetworkIP, ports: { internalPort }, appStatus } = project;
  // If the project has not started return undefined as the projectURL
  if (appStatus != 'started' && !dockerNetworkIP) {
    return undefined;
  }
  // Attempt to get container name fall back to docker network IP address (given to us by file-watcher)
  const container = await dockerInspect(project);
  const host = (container && container.Name) ? container.Name.substring(1) : dockerNetworkIP;
  return `${host}:${internalPort}`;
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
  const { name, startMode } = project;
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
