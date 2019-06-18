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
/**
 * This is a helper module for container.service/index.js. In tests, require('container.service') directly.
 * This module's purpose is to centralise as much docker logic as possible.
 *
 * Example usage:
 *    const dockerService = require(../modules/dockerService.js);
 *    const containerInfoList = await dockerService.getAppContainers();
 */
const dockerApi = require('dockerode');

const docker = new dockerApi();

function getCommands(containerName) {
  return {
    EXEC_COMMAND: `docker exec ${containerName}`,
    COPY_FROM_COMMAND: `docker cp ${containerName}:`,
    COPY_TO_COMMAND: 'docker cp ',
  };
}

function getContainerName(projectName) {
  return `/cw-${projectName}`;
}

/**
 * @returns {JSON[]} list of containerInfo JSONS, each with 4 string fields ('id', 'ip', 'exposedPort', 'internalPort')
 */
async function getAppContainers() {
  const containers = await getAllContainers();
  const mcContainers = containers.filter(container => (
    container.NetworkSettings.Networks.codewind_network
  ));
  return summariseContainerInfo(mcContainers);
}

async function getAllContainers() {
  const containerInfoList = await docker.listContainers();
  const containers = await Promise.all(containerInfoList.map(containerInfo =>
    docker.getContainer(containerInfo.Id).inspect()
  ));
  return containers;
}

function summariseContainerInfo(mcContainers) {
  return mcContainers.map(container => {
    const containerInfo = { id: container.Id };
    containerInfo.name = getAppName(container.Name);
    const { Networks, Ports } = container.NetworkSettings;
    containerInfo.ip = Networks.codewind_network.IPAddress; // non-cw containers won't have this, so this will error
    if (Ports) {
      const [internalPortAndProtocol] = Object.keys(Ports);
      containerInfo.exposedPort = Ports[internalPortAndProtocol][0].HostPort;
      [containerInfo.internalPort] = internalPortAndProtocol.split('/');
    }
    return containerInfo;
  });
}

/**
 * In the liberty case the container name contains a suffixed hash string that is not part of the
 * directory name of the app so it should be removed since the name is used for path resolution.
 * It is also uninteresting to the user so it shouldn't be displayed in the UI.
 */
function getAppName(name) {
  return name.includes('-idc-')
    ? name.substring(0, name.lastIndexOf('-idc-'))
    : name;
}

module.exports = {
  getCommands,
  getContainerName,
  getAppContainers,
};
