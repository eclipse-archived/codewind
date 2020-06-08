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

async function getNetworkConfigMap(projectID) {
  const res = await client.api.v1.namespaces(K8S_NAME_SPACE).configmaps.get({ qs: { labelSelector: `projectID=${projectID}` } });
  if (!res || !res.body || !res.body.items || res.body.items.length === 0) {
    return null;
  }
  const { items: configMaps } = res.body;
  return configMaps.find(configMap => {
    const { name } = configMap.metadata;
    return name.endsWith('-network');
  });
}

function updateConfigMap(updatedConfigMap) {
  const { metadata: { name } } = updatedConfigMap;
  return client.api.v1.namespaces(K8S_NAME_SPACE).configmaps(name).put({ body: updatedConfigMap });
}

async function getProjectDeployments(projectID) {
  const res = await client.apis.apps.v1.ns(K8S_NAME_SPACE).deploy.get({ qs: { labelSelector: `projectID=${projectID}` } });
  if (!res || !res.body || !res.body.items || res.body.items.length === 0) {
    log.warn(`Unable to inspect: project '${projectID}' has no deployment`);
    return null;
  }
  const { items: deployments } = res.body;
  return deployments;
}

async function patchProjectDeployments(projectID, patchBody) {
  const deployments = await getProjectDeployments(projectID);
  if (!deployments || deployments.length === 0) return null;
  // patch all deployments that match the query selector
  return Promise.all(deployments.map(deploy => {
    const { metadata: { name } } = deploy;
    return client.apis.apps.v1.ns(K8S_NAME_SPACE).deploy(name).patch({ body: patchBody });
  }));
}

async function getProjectIngress(projectID) {
  const res = await client.apis.extensions.v1beta1.ns(K8S_NAME_SPACE).ingresses.get({ qs: { labelSelector: `projectID=${projectID}` } });
  if (!res || !res.body || !res.body.items || res.body.items.length === 0) {
    return null;
  }
  const { items: ingresses } = res.body;
  const [ingress] = ingresses; // we don't support multiple ingresses so get the first item in the list
  return ingress;
}

async function getPortFromProjectIngress(projectID) {
  try {
    const ingress = await getProjectIngress(projectID);
    // sanitise the response ingress
    if (!ingress || !ingress.spec || !ingress.spec.rules
      || !ingress.spec.rules[0] || !ingress.spec.rules[0].http
      || !ingress.spec.rules[0].http.paths || !ingress.spec.rules[0].http.paths.length > 0
      || !ingress.spec.rules[0].http.paths[0].backend) {
      return null;
    }
    // Assume that we want the first rule and the first path in the http rules
    const { servicePort } = ingress.spec.rules[0].http.paths[0].backend;
    return servicePort;
  } catch(err) {
    // If getProjectIngress throws an error return null
    log.debug('Unable to get the service port from ingress');
    return null;
  }
}

async function getProjectRoute(projectID) {
  // We need the client to have the openshift custom resource definitions,
  // if the client doesn't know about them, loadSpec to get them
  if (!client.apis.hasOwnProperty('route.openshift.io')) {
    await client.loadSpec();
  }

  const res = await client.apis['route.openshift.io'].v1.ns(K8S_NAME_SPACE).routes.get({ qs: { labelSelector: `projectID=${projectID}` } });
  if (!res || !res.body || !res.body.items || res.body.items.length === 0) {
    return null;
  }
  const { items: routes } = res.body;
  const [route] = routes; // we don't support multiple routes so get the first item in the list
  return route;
}

async function getPortFromProjectRoute(projectID) {
  try {
    const route = await getProjectRoute(projectID);
    // sanitise the response route
    if (!route || !route.spec || !route.spec.port || !route.spec.port.targetPort) {
      return null;
    }

    const { targetPort } = route.spec.port;
    return targetPort;
  } catch(err) {
    // If getProjectRoute throws an error return null
    log.debug('Unable to get the service port from route');
    return null;
  }
}

async function getPortFromProjectIngressOrRoute(projectID) {
  const ports = await Promise.all([
    getPortFromProjectIngress(projectID),
    getPortFromProjectRoute(projectID),
  ]);
  // return the first non null value (or null if all are null)
  const port = ports.find(port => !!port);
  return port || null;
}

module.exports = {
  getContainerLogStream,
  spawnContainerProcess,
  findHCDFile,
  copyFileFromContainer,
  deleteFile,
  getNetworkConfigMap,
  updateConfigMap,
  getProjectDeployments,
  patchProjectDeployments,
  getPortFromProjectIngressOrRoute,
}
