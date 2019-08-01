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

/**
 * This function determines the ingress endpoint of the tekton dashboard if
 * its deployed and running 
 */
async function getTektonDashboard() {
  let tekton_dashboard_url = '';

  try {
    const client = new Client({ config: config.getInCluster(), version: '1.9'});

    if (global.codewind.RUNNING_IN_K8S){
      let ingress = await client.apis.extensions.v1beta1.namespaces(process.env.TEKTON_PIPELINE).ingress().get();
      if (ingress) {
        tekton_dashboard_url = (ingress.body.items[0].spec.rules[0].host) || '';
      } 
    }
  } catch (err) {
    log.error(err);
  }

  return tekton_dashboard_url;
}

/**
 * API Function to provide codewind runtime information to the UI
 */
router.get('/api/v1/environment', async (req, res) => {

  try {
    let body = {};
    body = {
      running_on_icp: global.codewind.RUNNING_IN_K8S,
      user_string: req.cw_user.userString,
      socket_namespace: req.cw_user.uiSocketNamespace,
      codewind_version: process.env.CODEWIND_VERSION,
      workspace_location: process.env.HOST_WORKSPACE_DIRECTORY,
      os_platform: process.env.HOST_OS || 'Linux',
      tekton_dashboard_url: await getTektonDashboard()
    }
    res.status(200).send(body);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

module.exports = router;
