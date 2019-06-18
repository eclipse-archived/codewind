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
const path = require('path');
const dockerode = require('dockerode');

const ProjectInitializerError = require('../modules/utils/errors/ProjectInitializerError');
const Logger = require('../modules/utils/Logger');

const docker = new dockerode();
const log = new Logger(__filename);
const dockerImage = 'codewind-initialize-amd64'

const validatePathForInitialize = (projectPath) => {
  if (typeof projectPath !== 'string') {
    throw new ProjectInitializerError(ProjectInitializerError.PATH_INVALID_TYPE)
  }
  if (projectPath === '') {
    throw new ProjectInitializerError(ProjectInitializerError.PATH_NOT_RESOLVED);
  }
  if (!path.isAbsolute(projectPath)) {
    throw new ProjectInitializerError(ProjectInitializerError.PATH_NOT_ABSOLUTE);
  }
}

const initializeProjectFromTemplate = async (projectPath, projectName, gitInfo) => {
  validatePathForInitialize(projectPath);
  const containerName = `initialize-${Date.now()}`;
  const projectInfo = await createContainerWithBoundProject(containerName, projectPath, projectName, gitInfo);
  projectInfo.projectPath = projectPath;
  try {
    await removeRunningContainer(containerName);
  } catch(err) {
    log.error(err)
  }
  log.trace(`Initialized project created from a template - Checked project info: ${ JSON.stringify(projectInfo) }`);
  if (projectInfo.status === 'failed' && projectInfo.result.includes('Git clone failed - directory to clone into is not empty')) {
    throw new ProjectInitializerError(ProjectInitializerError.TARGET_DIR_NOT_EMPTY, `${projectPath}`);
  }
  return projectInfo;
};

const initializeProjectFromLocalDir = async (projectPath) => {
  validatePathForInitialize(projectPath);
  const containerName = `initialize-${Date.now()}`;
  const projectInfo = await createContainerWithBoundProject(containerName, projectPath);
  projectInfo.projectPath = projectPath;
  try {
    await removeRunningContainer(containerName);
  } catch(err) {
    log.error(err)
  }
  log.trace(`Initialized local project - Checked project info: ${ JSON.stringify(projectInfo) }`);
  return projectInfo;
}

const createContainerWithBoundProject = async (containerName, projectPath, projectName, gitInfo) => {
  let container;
  const dockerBinds = [`${projectPath}:/initialize/`];
  const env = createEnvForContainerCreation(projectName, gitInfo);
  await checkForExistingContainer();
  await ensureImageExists();
  try {
    log.debug("Starting initializer container")
    container = await docker.createContainer({
      name: containerName,
      Image: dockerImage,
      Env: env,
      Tty: true,
      HostConfig: {
        Binds: dockerBinds
      }
    });
    const stream = await container.attach({stream: true, stdout: true, stderr: false});
    container.start();
    log.debug("Waiting for initializer container response");
    return new Promise((resolve, reject) => {
      const timeoutID = setTimeout(function() {
        reject('Initialization timeout');
      }, 20000);
      stream.on('data', data => {
        const result = data.toString();
        log.debug(`Response from initializer container: "${result}"`);
        let jsonData;
        try {
          jsonData = JSON.parse(result);
        }
        catch (err) {
          clearTimeout(timeoutID);
          log.error("Error parsing JSON from initializer container: " + err.message)
          return reject(err);
        }
        if (jsonData.status) {
          clearTimeout(timeoutID);
          return resolve(jsonData);
        }
        clearTimeout(timeoutID);
        const errMsg = jsonData.result || "Initialize failed but no error message was provided";
        return reject(errMsg);
      });
    });
  } catch (err) {
    log.error(err);
    if (container) await container.remove();
    if (err.statusCode === 502 && err.json.includes("Mounts denied")) {
      throw new ProjectInitializerError(ProjectInitializerError.PATH_NOT_MOUNTABLE, err.json.message);
    }
    throw new ProjectInitializerError(ProjectInitializerError.TEST_CONTAINER_FAILED, err.json.message);
  }
};

const checkForExistingContainer = async () => {
  try {
    const originalContainer = await docker.getContainer(dockerImage);
    try {
      await originalContainer.stop();
    } catch (error) {
      //if error, continue
    }
    await originalContainer.remove();
  } catch (error) {
    // Container didn't exist
  }
}

const ensureImageExists = async () => {
  const initializationImage = (await docker.listImages()).filter((image) => image.Id.startsWith(dockerImage));
  if(!initializationImage.length === 0) {
    throw new ProjectInitializerError(ProjectInitializerError.TEST_CONTAINER_FAILED, `The ${dockerImage} docker image does not exist, can't start container.`);
  }
};

const removeRunningContainer = async (containerName) => {
  const container = docker.getContainer(containerName);
  await container.stop();
  await container.remove();
}

const createEnvForContainerCreation = (projectName, gitInfo) => {

  // TODO: EXTENSIONS
  const cwExtensions = [
  ];

  const env = ['MC_SETTINGS=true', `CW_EXTENSIONS=${JSON.stringify(cwExtensions)}`];
  if (projectName && gitInfo.repo) {
    env.push(
      `PROJ_NAME=${projectName}`,
      `GIT_REPO=${gitInfo.repo}`,
    );
    if (gitInfo.branch) {
      env.push(`GIT_BRANCH=${gitInfo.branch}`);
    }
  }
  return env;
}

module.exports = {
  initializeProjectFromLocalDir,
  initializeProjectFromTemplate,
}
