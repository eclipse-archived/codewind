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
const TektonUtils = require('../modules/TektonUtils');
const Logger = require('../modules/utils/Logger');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to provide codewind runtime information to the UI
 */
router.get('/api/v1/environment', async (req, res) => {

  let tektonDashboard;
  if (global.codewind.RUNNING_IN_K8S) {
    tektonDashboard = await TektonUtils.getTektonDashboardUrl().then((tekton) => {
      return tekton;
    });
  } else {
    tektonDashboard = {status:false, message: TektonUtils.ERR_TEKTON_SERVICE_NOT_INSTALLED, url: ''};
  }

  try {
    const envData = {
      running_in_k8s: global.codewind.RUNNING_IN_K8S,
      user_string: req.cw_user.userString,
      socket_namespace: req.cw_user.uiSocketNamespace,
      codewind_version: process.env.CODEWIND_VERSION,
      image_build_time: process.env.IMAGE_BUILD_TIME,
      workspace_location: process.env.HOST_WORKSPACE_DIRECTORY,
      os_platform: process.env.HOST_OS || 'Linux',
      tekton_dashboard: tektonDashboard
    }
    res.status(200).send(envData);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

module.exports = router;
