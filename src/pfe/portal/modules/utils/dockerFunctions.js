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
const dockerApi = require('dockerode');
const docker = new dockerApi();
const Logger = require('../utils/Logger');
const log = new Logger('dockerFunctions.js');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const { spawn } = require('child_process');

/**
 * Exported function to stream the Docker container log for a given project
 * @param project, the project to get the container log for
 * @param outputCb, callback to send the logs to
 */
module.exports.getContainerLogStream = function getContainerLogStream(project, outputCb) {
  if (!project || !project.containerId || project.isClosed()) {
    log.warn(`Unable to get containerLogs: project does not exist, has no container or is closed`);
    return;
  }
  try {
    let containerId = project.containerId;
    let container = docker.getContainer(containerId);
    // create a single stream for stdin and stdout
    container.logs({
      follow: true,
      stdout: true,
      stderr: true
    }, function (err, stream) {
      if (err) {
        log.error(`Error getting containerLogStream for ${project.projectID}`);
        log.error(err);
      } else {
        outputCb(project, stream);
      }
    });
  } catch (err) {
    log.error('Docker containerLogStream error');
    log.error(err);
  }
}

module.exports.inspect = async function inspect(project) {
  if (!project || !project.containerId || project.isClosed()) {
    log.warn(`Unable to inspect: project does not exist, has no container or is closed`);
    return;
  }
  const container = await docker.getContainer(project.containerId).inspect();
  log.debug(`Container Inspect: ${JSON.stringify(container)}`);
  return container;
}

module.exports.exec = async function exec(project, command) {
  if (!project || !project.containerId || project.isClosed()) {
    log.warn(`Unable to exec: project does not exist, has no container or is closed`);
    return;
  }
  const container = docker.getContainer(project.containerId);
  const commandArray = convertToArray(command);
  const exec = await container.exec({ AttachStdout: true, AttachStderr: true, Cmd: commandArray });
  exec.start();
  // use the below code if debugging your exec command - this sends the output from the container to the portal logs
  // exec.start({hijack: true, stdin: true})
  // .then(stream => {
  //   container.modem.demuxStream(stream.output, process.stdout, process.stderr);
  // });
}

// Use spawn to run a given command inside the container and return the resulting
// child process.
module.exports.spawnContainerProcess = function spawnContainerProcess(project, commandArray) {
  const cmdArray = ['exec', '-i', project.containerId].concat(commandArray);
  return spawn('/usr/bin/docker', cmdArray);
}

module.exports.run = async function(containerName, command, volumes) {
  const commandArray = convertToArray(command);
  const options = {};
  if(volumes !== null && volumes !== undefined) {
    options.Hostconfig = { 'Binds': [volumes] };
  }
  await docker.run(containerName, commandArray, process.stdout, options);
}

module.exports.readFile = function readFile(project, path) {
  return new Promise((resolve, reject) => {
    if (!project || !project.containerId || project.isClosed()) {
      log.warn(`Unable to exec: project does not exist, has no container or is closed`);
      reject(`Unable to exec: project does not exist, has no container or is closed`);
    } else {
      const container = docker.getContainer(project.containerId);
      container.getArchive({ path }).then(stream => {
        let data = '';
        stream.on('data', chunk => { data += chunk });
        stream.on('end', () => { resolve(data) });
        stream.on('error', err => { reject(err) });
      });
    }
  });
}

module.exports.copyProjectContents = async function copyProjectContents(
  project,
  pathToPFEProject,
  projectRoot
) {
  // docker cp requires a trailing . to copy the contents of a directory
  const projectContents = `${pathToPFEProject}/.`;
  //  const dockerCommand = `docker exec ${project.containerId} cp ${fileToCopy} ${projectRoot}/${relativePathOfFile}`;
  const dockerCommand = `docker cp ${projectContents} ${project.containerId}:${projectRoot}`;
  log.debug(`[docker cp command] ${dockerCommand}`);
  await exec(dockerCommand);
};

module.exports.copyFile = async function copyFile(project, fileToCopy, projectRoot, relativePathOfFile) {
//  const dockerCommand = `docker exec ${project.containerId} cp ${fileToCopy} ${projectRoot}/${relativePathOfFile}`;
  const dockerCommand = `docker cp ${fileToCopy} ${project.containerId}:${projectRoot}/${relativePathOfFile}`;
  log.debug(`[docker cp command] ${dockerCommand}`);
  await exec(dockerCommand);
}

module.exports.findHCDFile = function findHCDFile(project, hcdDirectory) {
//  const command = 'ls ${hcdDirectory} | grep healthcenter';
//  const hcdName = this.run(project.containerId, command);
//  const hcdName = this.spawnContainerProcess(project, ['sh', '-c', `ls ${hcdDirectory} | grep healthcenter`]);
let process = this.spawnContainerProcess(project, ['sh', '-c', `ls ${hcdDirectory} | grep healthcenter`]);
let hcdName = "";
process.stdout.on('data', (hcdNameOrNothing) => {
  hcdName = hcdName + hcdNameOrNothing;
//  project.hcdName = hcdName;
  console.log(`############ ${hcdName}####`);
  project.hcdName = hcdName.trim();
  return project.hcdName;
});


//  console.log(`###### findHCDFile returned hcdName=${hcdName}`);

 // return hcdName;
}

module.exports.copyFileFromContainer = async function copyFile(project, destinationPath, sourceFileName) {
 // const dockerCommand = `docker cp ${project.containerId}:${sourcePath ${destinationPath}`;
//  log.info(`[docker cp command] ${dockerCommand}`);
  const dockerCommand = `docker cp ${project.containerId}:${sourceFileName} ${destinationPath}`;
  console.log(`####### dockerCommand=${dockerCommand}`);
  try {
    await exec(dockerCommand); 
  } catch (error) {
    log.error(`copyFileFromContainer: Error copying file ${sourceFileName} from ${project.containerId}`);
    throw(error);
  }
}

module.exports.deleteFile = async function deleteFile(project, projectRoot, relativePathOfFile) {
  const dockerCommand = `docker exec ${project.containerId} rm -rf ${projectRoot}/${relativePathOfFile}`;
  log.debug(`[docker rm command] ${dockerCommand}`);
  await exec(dockerCommand);
}

function convertToArray(object) {
  if(object === null || object === undefined) return [];
  return Array.isArray(object) ? object : [object];
}
