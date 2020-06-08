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
const cwUtils = require('../../modules/utils/sharedFunctions');
const ProjectLinkError = require('../../modules/utils/errors/ProjectLinkError');

const log = new Logger(__filename);

router.get('/api/v1/projects/:id/links', validateReq, checkProjectExists, (req, res) => {
  try {
    const { links } = getProjectFromReq(req);
    res.status(200).send(links.getAll());
  } catch (err) {
    handleError(err, res);
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

    await project.createLink({
      projectID: targetProjectID,
      projectName: targetProject.name,
      envName,
      projectURL,
    });
    log.info(`New project link created for ${project.name}`);

    // Send status and then kick off the restart/rebuild
    res.sendStatus(202);

    if (project.isOpen()) {
      await restartProjectToPickupLinks(user, project);
    }
    emitStatusToUI(user, project, 'success');
  } catch (err) {
    handleError(err, res, user, project);
  }
});

router.put('/api/v1/projects/:id/links', validateReq, checkProjectExists, async(req, res) => {
  const currentEnvName = req.sanitizeBody('envName');
  const newEnvName = req.sanitizeBody('updatedEnvName');

  const { cw_user: user } = req;
  const project = getProjectFromReq(req);
  try {
    // If newEnvName or newProjectURL are not given through the API, default them to their old values
    const updatedLinkEnvName = (newEnvName) ? newEnvName : currentEnvName;
    await project.updateLink(currentEnvName, updatedLinkEnvName);

    // Send status and then kick off the restart/rebuild
    res.sendStatus(202);

    if (project.isOpen()) {
      await restartProjectToPickupLinks(user, project);
    }
    emitStatusToUI(user, project, 'success');
  } catch (err) {
    handleError(err, res, user, project);
  }
});

router.delete('/api/v1/projects/:id/links', validateReq, checkProjectExists, async(req, res) => {
  const envNameOfLinkToDelete = req.sanitizeBody('envName');
  const { cw_user: user } = req;
  const project = getProjectFromReq(req);
  try {
    await project.deleteLink(envNameOfLinkToDelete);

    // Send status and then kick off the restart/rebuild
    res.sendStatus(202);

    if (project.isOpen()) {
      await restartProjectToPickupLinks(user, project);
    }
    emitStatusToUI(user, project, 'success');
  } catch (err) {
    handleError(err, res, user, project);
  }
});

function handleError(err, res, user = null, project = null) {
  log.error(err);
  // user and project will be null on API calls that don't require socket messages
  if (res.headersSent && user != null && project != null) {
    emitStatusToUI(user, project, 'failed', err);
    return;
  }
  switch(err.code) {
  case ProjectLinkError.CODES.INVALID_PARAMETERS:
    res.status(400).send(err);
    break;
  case ProjectLinkError.CODES.NOT_FOUND:
  case ProjectLinkError.CODES.CONTAINER_NOT_FOUND:
  case ProjectLinkError.CODES.SERVICE_NOT_FOUND:
  case ProjectLinkError.CODES.CONFIG_MAP_NOT_FOUND:
  case ProjectLinkError.CODES.DEPLOYMENT_NOT_FOUND:
    res.status(404).send(err);
    break;
  case ProjectLinkError.CODES.EXISTS:
    res.status(409).send(err);
    break;
  default:
    res.status(500).send(err);
  }
}

function emitStatusToUI(user, project, status, err = null) {
  const { name, projectID } = project;
  const error = (err && err.info) ? err.info : err;
  const data = {
    name,
    projectID,
    status,
    error,
  };
  log.info(`emitting ${status} for link operation on ${projectID}`);
  user.uiSocket.emit('projectLink', data);
}

function verifyTargetProjectExists(user, projectID) {
  const project = user.projectList.retrieveProject(projectID);
  if (!project) {
    throw new ProjectLinkError('NOT_FOUND', projectID);
  }
  return project;
}

async function getProjectURL(project) {
  const { projectID } = project;
  if (global.codewind.RUNNING_IN_K8S) {
    const { serviceName, port } = await project.getProjectKubeService();
    if (!serviceName || !port) throw new ProjectLinkError('SERVICE_NOT_FOUND', projectID);
    return `${serviceName}:${port}`;
  }
  const container = await cwUtils.inspect(project);
  if (!container || !project.ports) throw new ProjectLinkError('CONTAINER_NOT_FOUND', projectID);
  const { ports: { internalPort } } = project;
  const name = container.Name.substring(1);
  return `${name}:${internalPort}`;
}

async function restartProjectToPickupLinks(user, project) {
  if (global.codewind.RUNNING_IN_K8S) {
    const { extension } = project;
    if (extension) {
      await restartExtensionKubernetes(user, project);
    } else {
      // In K8s we use configmaps and restart Pods for our templates
      await updateNetworkConfigMap(project);
      await restartDeployment(project);
    }
  } else {
    // In Docker we use an env file or export into a container process
    const { projectType } = project;
    const projectTypesThatPickUpEnvsThroughRestart = ['nodejs', 'liberty', 'spring'];
    if (projectTypesThatPickUpEnvsThroughRestart.includes(projectType.toLowerCase())) {
      await restartNodeSpringLiberty(user, project);
    } else {
      await restartDocker(user, project);
    }
  }
}

async function restartNodeSpringLiberty(user, project) {
  const { name, startMode, links } = project;
  const linksFileExists = await links.envFileExists();
  const projectRoot = cwUtils.getProjectSourceRoot(project);
  const envFileName = links.getFileName();

  if (linksFileExists) {
    await cwUtils.copyFile(project, links.getFilePath(), projectRoot, envFileName);
  } else {
    await cwUtils.deleteFile(project, projectRoot, envFileName);
  }
  log.info(`Restarting ${name} to pick up network environment variables`);
  const mode = (startMode) ? startMode : 'run';
  await user.restartProject(project, mode);
}

async function restartDocker(user, project) {
  const { name, buildStatus, projectID } = project;
  // As this function will be repeated until it has verified whether the envs exist in the container
  // we need to ensure that the project has not been deleted
  const projectExists = user.projectList.retrieveProject(projectID);
  if (!projectExists) {
    return;
  }

  let container;
  try {
    container = await cwUtils.inspect(project);
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
      await user.buildProject(project, 'build');
    }
  } else {
    // if a build is in progress, wait 5 seconds and try again
    await cwUtils.timeout(5000);
    await restartDocker(user, project);
  }
}

async function updateNetworkConfigMap(project) {
  const { projectID, links } = project;
  const configMap = await cwUtils.getNetworkConfigMap(projectID);
  if (!configMap) throw new ProjectLinkError('CONFIG_MAP_NOT_FOUND', projectID);

  const updatedConfigMap = {
    ...configMap,
    data: links.getEnvPairObject(),
  }

  return cwUtils.updateConfigMap(updatedConfigMap);
}

async function restartDeployment(project) {
  const { projectID } = project;
  const date = new Date();
  const patchObj = {
    spec: {
      template: {
        metadata: {
          annotations: {
            'kubectl.kubernetes.io/restartedAt': date.toISOString(),
          },
        },
      },
    },
  };
  const patchResponses = await cwUtils.patchProjectDeployments(projectID, patchObj);
  if (!patchResponses) throw new ProjectLinkError('DEPLOYMENT_NOT_FOUND', projectID);
}

function checkIfEnvsExistInArray(project, array) {
  const { links } = project;
  const envPairs = links.getEnvPairs();
  return envPairs.every(env => array.includes(env));
}


async function restartExtensionKubernetes(user, project) {
  const { name, buildStatus, projectID } = project;
  // As this function will be repeated until it has verified whether the envs exist in the container
  // we need to ensure that the project has not been deleted
  const projectExists = user.projectList.retrieveProject(projectID);
  if (!projectExists) {
    return;
  }

  if (buildStatus != "inProgress") {
    try {
      const [deployment] = await cwUtils.getProjectDeployments(project.projectID);
      const { containers } = deployment.spec.template.spec;
      // Combine all the containers envs,
      // if one container contains all the link envs the deployment has been updated
      const containerEnvArrays = containers.map(({ env: envs }) => {
        return envs.map(({ name, value }) => `${name}=${value}`);
      });
      // Merge all container env arrays into one array
      const containerEnvs = [].concat(...containerEnvArrays);

      const linksExistInContainer = await checkIfEnvsExistInArray(project, containerEnvs);
      // Only build and run the project if the links are not in the container
      if (!linksExistInContainer) {
        log.info(`Rebuilding ${name} to pick up network environment variables - links not found in deployment`);
        await user.buildProject(project, 'build');
      }
    } catch (err) {
      // Fall back to assuming that the project needs rebuilding
      log.info(`Rebuilding ${name} to pick up network environment variables - deployment not found`);
      await user.buildProject(project, 'build');
    }
  } else {
    // if a build is in progress, wait 5 seconds and try again
    await cwUtils.timeout(5000);
    await restartExtensionKubernetes(user, project);
  }
}

module.exports = router;
