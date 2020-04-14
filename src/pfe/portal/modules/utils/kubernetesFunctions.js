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

const Client = require('kubernetes-client').Client
const config = require('kubernetes-client').config;
const client = new Client({ config: config.getInCluster(), version: '1.9'});
const K8S_NAME_SPACE = process.env.KUBE_NAMESPACE || 'default';
const Logger = require('../utils/Logger');
const log = new Logger('kubernetesFunctions.js');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const { spawn } = require('child_process');

/**
 * Exported function to get the Kubernetes container logs for a given project
 * @param project, the project to get the container logs for
 * @param outputCb, callback to send the logs to
 */
function getContainerLogStream(project, outputCb) {
  if (!project || !project.podName || project.isClosed()) {
    log.warn(`Unable to get containerLogs: project does not exist, has no container or is closed`);
    return;
  }
  try {
    // When a container isn't specified 'log' defaults to the only container if
    // there is one container in the pod.
    const stream = client.api.v1.namespaces(K8S_NAME_SPACE).pods(project.podName).log.getStream({ qs: { follow: true } });
    outputCb(project, stream);

  } catch(err) {
    log.error(`getContainerLogStream: Error getting logs for ${project.podName}`);
    log.log(err);
  }
}

// Use spawn to run a given command inside the container and return the resulting
// child process.
function spawnContainerProcess(project, commandArray) {
  const cmdArray = ['exec', '-i', project.podName, '-n', K8S_NAME_SPACE, '--'].concat(commandArray);
  return spawn('/usr/local/bin/kubectl', cmdArray);
}

function findHCDFile(project, hcdDirectory) {
  const process = this.spawnContainerProcess(project, ['sh', '-c', `ls ${hcdDirectory} | grep healthcenter`]);
  let hcdName = "";
  process.stdout.on('data', (hcdNameOrNothing) => {
    // Convert the name to a string and trim
    hcdName = hcdName + hcdNameOrNothing;
    project.hcdName = hcdName.trim();
    log.debug(`findHCDFile found ${project.hcdName}`)
    return project.hcdName;
  });
}

async function copyFileFromContainer(project, sourceName, destinationName) {
  const kubeCommand = `kubectl cp ${K8S_NAME_SPACE}/${project.podName}:${sourceName} ${destinationName}`;
  log.debug(`copyFileFromContainer [kubectl cp command] ${kubeCommand}`);
  try {
    await exec(kubeCommand); 
  } catch (error) {
    log.error(`copyFileFromContainer: Error copying file ${sourceName} from ${project.podName}`);
    throw(error);
  }
}

async function deleteFile(project, projectRoot, relativePathOfFile) {
  const kubeCommand = `kubectl exec ${project.podName} -n ${K8S_NAME_SPACE} -- rm -rf ${projectRoot}/${relativePathOfFile}`;
  log.debug(`[kubectl rm command] ${kubeCommand}`);
  await exec(kubeCommand);
}

module.exports = {
  getContainerLogStream,
  spawnContainerProcess,
  findHCDFile,
  copyFileFromContainer,
  deleteFile,
}
