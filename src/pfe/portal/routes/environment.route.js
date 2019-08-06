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
const express = require('express');

const Logger = require('../modules/utils/Logger');

const router = express.Router();
const log = new Logger(__filename);

const Client = require('kubernetes-client').Client
const config = require('kubernetes-client').config;

const tktErrRes = "error";
const tktNotInstalledRes = "not-installed";

/**
 * This function determines the ingress endpoint of the tekton dashboard if
 * its deployed and running
 */
async function getTektonDashboardUrl() {
  log.debug("Determining Tekton dashboard URL");
  if (!global.codewind.RUNNING_IN_K8S) {
    // no tekton in local case
    return "";
  }

  try {
    const client = new Client({ config: config.getInCluster(), version: '1.9'});
    const tktNamespaceName = process.env.TEKTON_PIPELINE;
    log.info(`Looking for ingresses in Tekton namespace ${tktNamespaceName}`);
    const ingresses = await client.apis.extensions.v1beta1.namespaces(tktNamespaceName).ingress().get();
    if (ingresses && ingresses.body && ingresses.body.items[0]) {
      return (ingresses.body.items[0].spec.rules[0].host || tktErrRes);
    }
    log.info(`No ingress was found in Tekton namespace ${tktNamespaceName}. Is Tekton installed?`);
    return tktNotInstalledRes;
  } catch (err) {
    log.error(`Unexpected error getting Tekton URL: ${JSON.stringify(err)}`);
  }
  return tktErrRes;
}

let tektonDashboardUrl;
let tektonDashboardUrlPromise;

/**
 * API Function to provide codewind runtime information to the UI
 */
router.get('/api/v1/environment', async (req, res) => {

  if (!tektonDashboardUrl) {
    // just await on this promise if it exists so we only call getTektonDashboardUrl once
    if (!tektonDashboardUrlPromise) {
      tektonDashboardUrlPromise = getTektonDashboardUrl()
        .then((tektonUrl) => {
          log.info(`Initialized Tekton dashboard url as "${tektonUrl}"`)
          return tektonUrl;
        });
    }
    tektonDashboardUrl = await tektonDashboardUrlPromise;
  }

  try {
    const envData = {
      running_in_k8s: global.codewind.RUNNING_IN_K8S,
      user_string: req.cw_user.userString,
      socket_namespace: req.cw_user.uiSocketNamespace,
      codewind_version: process.env.CODEWIND_VERSION,
      workspace_location: process.env.HOST_WORKSPACE_DIRECTORY,
      os_platform: process.env.HOST_OS || 'Linux',
      tekton_dashboard_url: tektonDashboardUrl,
    }
    res.status(200).send(envData);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

module.exports = router;
