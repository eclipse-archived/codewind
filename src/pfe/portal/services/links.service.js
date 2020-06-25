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
const Logger = require('../modules/utils/Logger');
const cwUtils = require('../modules/utils/sharedFunctions');
const ProjectLinkError = require('../modules/utils/errors/ProjectLinkError');

const log = new Logger(__filename);

function emitStatusToUI(user, project, status, link, err = null) {
  const { name, projectID } = project;
  const error = (err && err.info) ? err.info : err;
  const data = {
    name,
    projectID,
    link,
    status,
    error,
  };
  log.info(`emitting ${status} for link operation on ${projectID}`);
  user.uiSocket.emit('projectLink', data);
}

async function handleProjectRestartAndSocketEmit(user, project, link, forceRebuild) {
  try {
    // Restarting a project takes time so send a projectChanged event to update the UI
    user.uiSocket.emit('projectChanged', project.toJSON());
    if (project.isOpen()) {
      // forceRestart on delete to ensure we remove the environment variable
      await restartProjectToPickupLinks(user, project, forceRebuild);
    }
    emitStatusToUI(user, project, 'success', link);
  } catch (err) {
    emitStatusToUI(user, project, 'error', link, err);
  }
}

function verifyTargetProjectExists(user, projectID) {
  const project = user.projectList.retrieveProject(projectID);
  if (!project) {
    throw new ProjectLinkError('TARGET_PROJECT_NOT_FOUND', projectID);
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

async function restartProjectToPickupLinks(user, project, forceRebuild) {
  const { extension, projectType } = project;
  if (global.codewind.RUNNING_IN_K8S && !extension) {
    // In K8s we use configmaps and restart Pods for our templates
    await updateNetworkConfigMap(project);
    await restartDeployment(project);
  } else if (!global.codewind.RUNNING_IN_K8S && projectType && ['nodejs', 'liberty', 'spring'].includes(projectType.toLowerCase())) {
    // In Docker we have specific link capabilities for Nodejs, Liberty and Spring
    await restartNodeSpringLiberty(user, project);
  } else {
    // Everything else is restarted using the same function
    await restartProject(user, project, forceRebuild);
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

async function getDockerContainerEnvs(project) {
  try {
    const container = await cwUtils.inspect(project);
    const { Config: { Env: containerEnvs }} = container;
    return containerEnvs;
  } catch (err) {
    // If error, return an empty array
    return [];
  }
}

async function getKubernetesDeploymentEnvs(project) {
  try {
    // Check whether the deployment already contains the current link variables
    // They could have already been picked up in a previous rebuild while the buildStatus was inProgress
    // Should remove unneccessary rebuilds
    const { projectID } = project;
    const [deployment] = await cwUtils.getProjectDeployments(projectID);
    const { containers } = deployment.spec.template.spec;
    // Combine all the containers envs,
    // if one container contains all the link envs the deployment has been updated
    const containerEnvArrays = containers.map(({ env: envs }) => {
      return envs.map(({ name, value }) => `${name}=${value}`);
    });
    // Merge all container env arrays into one array
    const containerEnvs = [].concat(...containerEnvArrays);
    return containerEnvs;
  } catch(err) {
    // If error, return an empty array
    return [];
  }
}

// Handles the restarting and link pick up for
// * Docker style projects (local only)
// * Swift style (local only)
// * Extension type projects (local and kube)
async function restartProject(user, project, forceBuild) {
  const { name, buildStatus, projectID } = project;
  // As this function will be repeated until it has verified whether the envs exist in the container
  // we need to ensure that the project has not been deleted
  const projectExists = user.projectList.retrieveProject(projectID);
  if (!projectExists) {
    return null;
  }

  if (buildStatus != "inProgress") {
    if (forceBuild) {
      // if forceBuild skip the logic below and just rebuild
      log.info(`Rebuilding ${name} to pick up network environment variables - forceRebuild`);
      return user.buildProject(project, 'build');
    }

    const containerEnvs = (global.codewind.RUNNING_IN_K8S)
      ? await getKubernetesDeploymentEnvs(project)
      : await getDockerContainerEnvs(project);

    const linksExistInContainer = checkIfEnvsExistInArray(project, containerEnvs);
    // Only build and run the project if the links are not in the container
    if (linksExistInContainer) {
      // Do nothing and return if the links are already in the container
      return null;
    }
    log.info(`Rebuilding ${name} to pick up network environment variables`);
    return user.buildProject(project, 'build');
  }
  // if a build is in progress, wait 5 seconds and try again
  await cwUtils.timeout(5000);
  return restartProject(user, project);
}

module.exports = {
  handleProjectRestartAndSocketEmit,
  verifyTargetProjectExists,
  getProjectURL,
  restartProjectToPickupLinks,
}
