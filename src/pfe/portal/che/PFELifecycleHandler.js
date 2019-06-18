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

// Synchronous functions are allowed in this script because it is executed in a separate process to the express server
const execSync = require('child_process').execSync; // eslint-disable-line no-sync
const readFileSync = require('fs').readFileSync; // eslint-disable-line no-sync

const JSONStream = require('json-stream')
const Client = require('kubernetes-client').Client
const config = require('kubernetes-client').config
const client = new Client({ config: config.getInCluster(), version: '1.9' })

const DEPLOYMENT_LABELS_FILTER = {
  "che.original_name": "che-workspace-pod",
  "che.workspace_id": `${process.env.CHE_WORKSPACE_ID}`
}

let current_namespace = '';

function watch(removeCodewind) {
  try {
    let initializedSuccess = true;
    const stream = client.apis.apps.v1beta1.watch.ns(current_namespace).deploy('').getStream()

    const jsonStream = new JSONStream()
    stream.pipe(jsonStream)
    jsonStream.on('data', (event) => {
      if (event.kind === "Status" && event.status === "Failure") {
        console.log('ERROR:  Failed to set up the Che workspace watching mechanism.\n        Codewind is unable to monitor the workspace. The role bound to this pod\'s service account may be missing the \'watch\' verb for deployments. This is required in order for proper cleanup of resources created by the Codewind Che plugin. Ensure the Codewind setup instructions were followed correctly to address this problem. The Codewind resources must be cleaned up manually since the Che workspace cannot be monitored.');
        initializedSuccess = false;
      }

      // Only watch for deleted deployments with the custom label
      if (event.type === "DELETED"
        && event.object.metadata.labels
        && event.object.metadata.labels['che.original_name'] === "che-workspace-pod"
        && event.object.metadata.labels['che.workspace_id'] === process.env.CHE_WORKSPACE_ID
      ) {
        console.log(`${event.object.metadata.name} was deleted`)
        removeCodewind()
      }

    })

    jsonStream.on('end', async () => {
      try {
        if (initializedSuccess) {
          // Keep the watcher running while the deployment exists
          if (await deploymentExists()) {
            watch(removeCodewind)
          } else {
            console.log("Removing Codewind resources...")
            // Remove resources if the workspace has been removed
            removeCodewind()
          }
        }
      } catch (err) {
        console.log("Watch failed with an unexpected error")
        console.log(err)
      }

    })


  } catch (err) {
    console.error('ERROR: Failed to start the workspace watching mechanism.', err)
  }
}

function deploymentExists() {
  const promise = new Promise(async function (resolve, reject) {
    try {
      const deployment = await client.apis.apps.v1.namespaces(current_namespace).deployments('').get()
      if (deployment.body.items) {
        const filtered = filterDeploymentList(deployment.body.items);
        
        if (filtered.length > 0) {
          resolve(true);
        } else {
          console.log("No deployment found.")
          resolve(false);
        }
      }
    } catch (err) {
      reject(err)
    }
  });
  return promise;
}

function filterDeploymentList(deploymentList) {
  return deploymentList.filter(item => {
    return item.metadata.labels && matchesDeploymentLabels(item.metadata.labels);
  });
}

function matchesDeploymentLabels(labels) {
  for (const label in DEPLOYMENT_LABELS_FILTER) {
    if (!labels[label] || labels[label] != DEPLOYMENT_LABELS_FILTER[label]) {
      return false;
    }
  }
  return true;
}

const removeCodewind = function () {
  console.log("Remove the Codewind resources")
  try {
    let result = execSync(`kubectl delete svc --selector=app=codewind-pfe --selector=workspace=${process.env.CHE_WORKSPACE_ID}`)
    console.log(result.toString())
    result = execSync(`kubectl delete deploy --selector=app=codewind-pfe --selector=workspace=${process.env.CHE_WORKSPACE_ID}`)
    console.log(result.toString())
  } catch (err) {
    console.log("ERROR: Codewind removal failed")
    console.log(err);
  }
}

function getNamespace() {
  const namespace = readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/namespace").toString();
  console.log(`Current namespace: ${namespace}`);
  return namespace;
}

// This script is only required when Codewind is running in Kuberenetes
if (process.env.IN_K8) {
  if (!process.env.CHE_WORKSPACE_ID) {
    console.log('The CHE_WORKSPACE_ID environment variable is not set. Workspace detection in the Che Codewind plugin has failed.')
  }
  current_namespace = getNamespace();
  console.log(`Start watching for che workspace  ${process.env.CHE_WORKSPACE_ID}`)
  // Keep the watcher running while the deployment exists
  const promise = deploymentExists();
  promise
    .then((result) => {
      if (result) {
        console.log("Start watching...")
        watch(removeCodewind)
      } else {
        console.log("Removing Codewind resources...")
        // Remove resources if the workspace has been removed
        removeCodewind()
      }
    })
    .catch((err) => {
      console.log("ERROR: Codewind is unable to monitor the Che workspace. The Codewind resources will need to be removed manually after the Che workspace has been deleted.")
      console.log('ERROR: The role bound to this pod\'s service account may be missing the \'get\' verb for deployments. This is required in order for automatic cleanup of resources created by the Codewind Che plugin. Ensure the Codewind setup instructions were followed correctly to address this problem.');
      console.log(`    ${err.message}`)
    })
}