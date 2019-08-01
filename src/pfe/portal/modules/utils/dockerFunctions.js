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

function convertToArray(object) {
  if(object === null || object === undefined) return [];
  return Array.isArray(object) ? object : [object];
}
