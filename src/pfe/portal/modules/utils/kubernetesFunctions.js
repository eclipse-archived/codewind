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

/**
 * Exported function to get the Kubernetes container logs for a given project
 * @param project, the project to get the container logs for
 * @param outputCb, callback to send the logs to
 */
module.exports.getContainerLogStream = function getContainerLogStream(project, outputCb) {
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

module.exports.copyFile = async function copyFile(project, pathToWriteTo, projectRoot, relativePathOfFile) {
  const kubeCommand = `kubectl cp ${pathToWriteTo} ${project.containerId}:${projectRoot}/${relativePathOfFile}`;
  log.debug(`[kubectl cp command] ${kubeCommand}`);
  await exec(kubeCommand);
}
