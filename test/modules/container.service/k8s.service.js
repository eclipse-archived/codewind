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
 * This is a helper module for container.service/index.js. In tests, require('container.service') directly
 * This module's purpose is to centralise as much k8s logic as possible.
 *
 * Example usage:
 *    const k8sService = require(../modules/k8sService.js);
 *    const containerInfoList = await k8sService.getAppContainers();
 */
const Client = require('kubernetes-client').Client;
const config = require('kubernetes-client').config;

const { K8S_NAME_SPACE, USING_K8S } = require('../../config');

let client;
// Check if we're in a Kubernetes environment
try {
    if (USING_K8S) {
        client = new Client({ config: config.fromKubeconfig(), version: '1.9' });
        console.log(`Using kubecConfig, namespace is ${K8S_NAME_SPACE}`);
    // TODO replace this block with:
    // if (!USING_K8S) throw new Error(`USING_K8S should be true, but is false (${USING_K8S})`);
    }
} catch (err) {
  // Probably not an error, we just aren't running inside kubernetes.
    console.log('Kubernetes cluster configuration unavailable.');
}

function getCommands(containerName, podName) {
    return {
        EXEC_COMMAND: `kubectl exec ${podName} -c ${containerName} -- `,
        COPY_FROM_COMMAND: `kubectl cp -c ${containerName} ${podName}:`,
        COPY_TO_COMMAND: `kubectl cp -c ${containerName} `,
    };
}

function getContainerName(projectName, projectID) {
    let containerName = `cw-${projectName.substring(0, 23)}-${projectID.substring(0, 23)}`;
    if (containerName.length > 53) containerName = containerName.substring(0, 53);
    if (containerName.endsWith('-')) containerName = containerName.slice(0, -1);
    return containerName;
}

/**
 * @returns {JSON[]} list of containerJSONs each with 4 string fields ('id', 'ip', 'exposedPort', 'internalPort')
 */
async function getAppContainers() {
    const list = [];
  // Find containers that match one of our projects.
    try {
        const deployments = await client.apis.apps.v1.namespaces(K8S_NAME_SPACE).deployments().get();
        for (const deployment of deployments.body.items) {
            try {
                const deploymentName = deployment.metadata.name;
                const json = {};
                json.name = getAppName(deploymentName);
        // Assume for the moment there's only one container per deployment.
                const [container] = deployment.spec.template.spec.containers;
                let hostPort = 0;
                if (container.ports && container.ports.length > 0) {
                    hostPort = container.ports[0].containerPort;
                }
                json.exposedPort = hostPort;
                json.internalPort = hostPort;
                list.push(json);
            } catch (err) {
        // We may be looking at someone else's deployment that is missing expected fields
                console.dir(err);
            }
        }
    } catch (err) {
        console.dir(err);
    }
    return list;
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
