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

const { validateReq } = require('../middleware/reqValidator');
const Logger = require('../modules/utils/Logger');
const TemplateError = require('../modules/utils/errors/TemplateError');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to return a list of available templates
 * @return the set of language extensions as a JSON array of strings
 */
router.get('/api/v1/templates', validateReq, async (req, res, _next) => {
  const { templates: templateController } = req.cw_user;
  const { showEnabledOnly, projectStyle } = req.query;
  try {
    const templates = (projectStyle) 
      ? await templateController.getTemplatesByStyle(projectStyle, showEnabledOnly)
      : await templateController.getTemplates(showEnabledOnly);
    if (templates.length == 0) {
      log.warn('No templates found');
      res.sendStatus(204);
    } else {
      res.status(200).json(templates);
    }
  } catch (error) {
    log.error(error);
    res.status(500).json(error);
  }
});

/**
 * API Function to return a list of available templates
 * @return the set of language extensions as a JSON array of strings
 */
router.get('/api/v1/templates/repositories', async (req, res, _next) => {
  await sendRepositories(req, res, _next);
});

router.post('/api/v1/templates/repositories', validateReq, async (req, res, _next) => {
  const { templates: templatesController } = req.cw_user;
  const repositoryName = req.sanitizeBody('name')
  const repositoryUrl = req.sanitizeBody('url');
  const repositoryDescription = req.sanitizeBody('description');
  const isRepoProtected = req.sanitizeBody('protected');

  try {
    await templatesController.addRepository(
      repositoryUrl,
      repositoryDescription,
      repositoryName,
      isRepoProtected
    );
    await sendRepositories(req, res, _next);
  } catch (error) {
    log.error(error);
    const knownErrorCodes = ['INVALID_URL', 'DUPLICATE_URL', 'URL_DOES_NOT_POINT_TO_INDEX_JSON', 'ADD_TO_PROVIDER_FAILURE'];
    if (error instanceof TemplateError && knownErrorCodes.includes(error.code)) {
      res.status(400).send(error.message);
      return;
    }
    res.status(500).send(error.message);
  }
});

router.delete('/api/v1/templates/repositories', validateReq, async (req, res, _next) => {
  const { templates: templatesController } = req.cw_user;
  const repositoryUrl = req.sanitizeBody('url');
  try {
    await templatesController.deleteRepository(repositoryUrl);
    await sendRepositories(req, res, _next);
  } catch (error) {
    log.error(error);
    if (error instanceof TemplateError && error.code === 'REPOSITORY_DOES_NOT_EXIST') {
      res.status(404).send(error.message);
      return;
    }
    res.status(500).send(error.message);
  }
});

async function sendRepositories(req, res, _next) {
  const { templates: templatesController } = req.cw_user;
  const repositoryList = await templatesController.getRepositories();
  res.status(200).json(repositoryList);
}

router.patch('/api/v1/batch/templates/repositories', validateReq, async (req, res) => {
  const { templates: templatesController } = req.cw_user;
  const requestedOperations = req.body;
  const operationResults = await templatesController.batchUpdate(requestedOperations);
  res.status(207).json(operationResults);
});

/**
 * @return {[String]} the list of template styles
 */
router.get('/api/v1/templates/styles', validateReq, async (req, res, _next) => {
  const { templates: templatesController } = req.cw_user;
  const styles = await templatesController.getAllTemplateStyles();
  res.status(200).json(styles);
});

module.exports = router;
