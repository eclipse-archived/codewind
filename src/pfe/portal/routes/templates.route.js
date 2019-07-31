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
const { validateReq } = require('../middleware/reqValidator');

/**
 * API Function to return a list of available templates
 * @queryparam {String} the set of language extensions as a JSON array of strings
 * @return the set of language extensions as a JSON array of strings
 */
router.get('/api/v1/templates', validateReq, async (req, res, _next) => {
  const user = req.cw_user;
  const projectStyle = req.query.projectStyle;

  const projectTemplates = (projectStyle)
    ? await user.templates.getTemplatesOfStyle(projectStyle)
    : await user.templates.getTemplateList();

  if (projectTemplates.length == 0) {
    log.warn('No templates found');
    res.sendStatus(204);
  } else {
    res.status(200).json(projectTemplates);
  }
});

/**
 * API Function to return a list of available templates
 * @return the set of language extensions as a JSON array of strings
 */
router.get('/api/v1/templates/repositories', sendRepositories);

router.post('/api/v1/templates/repositories', validateReq, (req, res, _next) => {
  const user = req.cw_user;
  const repositoryUrl = req.sanitizeBody('url');
  const repositoryDescription = req.sanitizeBody('description');

  try {
    new URL(repositoryUrl);
  } catch(err) {
    log.error(`Invalid repository url: ${err}`);
    res.status(400).send("Invalid repository URL");
    return;
  }
  if (!user.templates.addRepository(repositoryUrl, repositoryDescription)) {
    res.status(400).send("Repository url already available.");
    return;
  }
  sendRepositories(req, res, _next);
});

router.delete('/api/v1/templates/repositories', validateReq, (req, res, _next) => {
  const user = req.cw_user;
  const repositoryUrl = req.sanitizeBody('url');
  user.templates.deleteRepository(repositoryUrl);
  sendRepositories(req, res, _next);
});

function sendRepositories(req, res, _next) {
  const user = req.cw_user;
  const repositoryList = user.templates.getRepositories();
  res.status(200).json(repositoryList);
}

/**
 * @return {[String]} the list of template styles
 */
router.get('/api/v1/templates/styles', validateReq, async (req, res, _next) => {
  const user = req.cw_user;
  const styles = await user.templates.getTemplateStyles();
  res.status(200).json(styles);
});

module.exports = router;
