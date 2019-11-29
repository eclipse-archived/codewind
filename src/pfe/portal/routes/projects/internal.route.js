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
const Logger = require('../../modules/utils/Logger');

const router = express.Router();
const log = new Logger(__filename);
const white_list = ["localhost:9090","localhost:9191"]

router.post('/internal/api/v1/projects/updateStatus', async function (req, res) {
  log.debug("Internal API: updateStatus");
  const host = req.get('host');
  if ( white_list.indexOf(host) < 0 ) {
    const err = "Request host is not in white list."
    res.status(500).send(err);
    return;
  }
  try {
    const user = req.cw_user;
    const projectID = req.sanitizeBody('projectID');
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
      return;
    }
    await user.updateStatus(req.body);
    res.sendStatus(200);
  } catch (err) {
    log.error(err.info);
    res.status(500).send(err);
  }
});

router.post('/internal/api/v1/projects/imagePushRegistryStatus', async function (req, res) {
  log.debug("Internal API: imagePushRegistryStatus");
  const host = req.get('host');
  if ( white_list.indexOf(host) < 0 ) {
    const err = "Request host is not in white list."
    res.status(500).send(err);
    return;
  }
  try {
    const user = req.cw_user;
    const projectID = req.sanitizeBody('projectID');
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
      return;
    }
    await user.imagePushRegistryStatus(req.body);
    res.sendStatus(200);
  } catch (err) {
    log.error(err.info);
    res.status(500).send(err);
  }
});


router.get('/internal/api/v1/projects/:id/logs/:type', async function (req, res) {
  log.debug("Internal API: get new logs");
  const host = req.get('host');
  if ( white_list.indexOf(host) < 0 ) {
    const err = "Request host is not in white list."
    res.status(500).send(err);
    return;
  }
  try {
    const user = req.cw_user;
    const projectID = req.sanitizeParams('id');
    const type = req.sanitizeParams('type');
    if (!projectID || !type ) {
      res.status(400).send("Missing required parameter, projectID and type are required to be provided. ");
      return;
    }
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
      return;
    }
    await user.checkNewLogFile(projectID, type);
    res.sendStatus(200);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

module.exports = router;
