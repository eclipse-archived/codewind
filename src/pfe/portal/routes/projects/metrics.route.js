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
const ProjectListError = require('../../modules/utils/errors/ProjectListError');
const ProjectError = require('../../modules/utils/errors/ProjectError');
const ProjectMetricsError = require('../../modules/utils/errors/ProjectMetricsError');
const Project = require('../../modules/Project');
const { validateReq } = require('../../middleware/reqValidator');
const metricsController = require('../../controllers/metrics.controller');

const router = express.Router();
const log = new Logger(__filename);

/**
 * Get a list of metric types for a specified project and their endpoints for access
 * @param project, the project
 * @return the list of metric types
 */
router.get('/api/v1/projects/:id/metrics', function (req, res) {
  const projectID = req.sanitizeParams('id');
  try {
    const user = req.cw_user;
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      const message = `Unable to find project ${projectID}`;
      log.error(message);
      res.status(404).send({ message });
      return;
    }

    const metricTypes = Project.getMetricTypes();
    const metrics = metricTypes.map((type) => {
      return { type, endpoint: `/metrics/${type}` };
    })
    res.set('count', metricTypes.length);
    res.status(200).send(metrics);
  } catch (err) {
    log.error(err);
    if (err instanceof ProjectListError && err.code === 'NOT_FOUND') {
      res.status(404).send(err.info);
    } else {
      res.status(500).send(err.info || err);
    }
  }
});

/**
 * Function to check if project can support metrics
 * @param id, the id of the project
 * @return 200 if project existed and the metricsCheck completes
 * @return 400 if project build file is not found
 * @return 404 if project is not found
 * @return 500 on internal error
 */

router.get('/api/v1/projects/:id/metrics/status', async function (req, res) {
  try {
    const user = req.cw_user;
    const projectID = req.sanitizeParams('id');
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      const message = `Unable to find project ${projectID}`;
      log.error(message);
      res.status(404).send({ message });
      return;
    }
    const isMetricsAvailable = await project.checkIfMetricsAvailable();
    res.status(200).send({ metricsAvailable: isMetricsAvailable });
  } catch (err) {
    log.error(err.info || err);
    if (err.code === 'BUILD_FILE_MISSING') {
      res.status(400).send(err.info || err);
    } else {
      res.status(500).send(err.info || err);
    }
  }
});

/**
 * Returns metrics data for a project (given a list of metrics types in req.body.types)
 * @param id, the id of the project
 * @return {[JSON]} metricsData for the project specified (in format { type, metrics })
 */
router.post('/api/v1/projects/:id/metrics/types', async function(req, res) {
  const projectID = req.sanitizeParams('id');
  try {
    const user = req.cw_user;
    const project = user.projectList.retrieveProject(projectID);

    if (!project) {
      const message = `Unable to find project ${projectID}`;
      log.error(message);
      res.status(404).send({ message });
      return;
    }

    const metricsTypes = req.sanitizeBody('types');
    if (!metricsTypes) {
      res.status(400).send(`No metrics found`);
      return;
    }

    const metricsData = await Promise.all(metricsTypes.map(async (type) => {
      const metrics = await project.getMetrics(type);
      return { type, metrics };
    }));

    res.set('count', metricsData.length);
    res.status(200).send(metricsData);

  } catch (err) {
    log.error(err);
    if (err instanceof ProjectError && err.code === 'INVALID_METRIC_TYPE') {
      res.status(404).send(err.info);
    } else if (err instanceof ProjectError && err.code === 'LOAD_TEST_DIR_ERROR') {
      res.status(422).send(err.info);
    } else {
      res.status(500).send(err.info || err);
    }
  }
});

/**
 * API Function to return a time/value set of metric values for a specified project
 * @param project, the project
 * @return the set of metrics
 */
router.get('/api/v1/projects/:id/metrics/:type', async function (req, res) {
  const projectID = req.sanitizeParams('id');
  const metricType = req.sanitizeParams('type');
  try {
    const user = req.cw_user;
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      const message = `Unable to find project ${projectID}`;
      log.error(message);
      res.status(404).send({ message });
      return;
    }

    const metrics = await project.getMetrics(metricType);
    res.set('count', metrics.length);
    res.status(200).send(metrics);

  } catch (err) {
    log.error(err);
    if (err instanceof ProjectError && err.code === 'INVALID_METRIC_TYPE') {
      res.status(404).send(err.info);
    } else if (err instanceof ProjectError && err.code === 'LOAD_TEST_DIR_ERROR') {
      res.status(422).send(err.info);
    } else {
      res.status(500).send(err.info || err);
    }
  }
});

router.post('/api/v1/projects/:id/metrics/inject', validateReq, metricsController.inject);

/**
* Updates the description of a specific load-test run on a specified project
* @param id, the id of the project
* @param testRunTime, the time when the load-test ran
* @return {JSON} { description: 'newDescription' }
*/
router.put('/api/v1/projects/:id/metrics/:testRunTime', async function (req, res) {
  try {
    const description = req.sanitizeBody('description');
    if (!description && description !== '') {
      const message = 'request body has no \'description\' field';
      log.error(message);
      res.status(400).send({ message });
      return;
    }
    const projectID = req.sanitizeParams('id');
    const user = req.cw_user;
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      const message = `Unable to find project ${projectID}`;
      log.error(message);
      res.status(404).send({ message });
      return;
    }

    const testRunTime = req.sanitizeParams('testRunTime');
    await project.updateMetricsDescription(testRunTime, description);
    const newMetrics = await project.getMetricsByTime(testRunTime);

    res.status(200).send({ description: newMetrics.desc });

  } catch (err) {
    log.error(err);
    if (err instanceof ProjectMetricsError && err.code === 'NOT_FOUND') {
      res.status(404).send(err.info || err);
    } else {
      res.status(500).send(err.info || err);
    }
  }
});

/**
* Deletes the results from a specific load-test run on a specified project
* @param id, the id of the project
* @param testRunTime, the time when the load-test ran
* @return 200 if the specified load-test run on the project was successfully deleted
* @return 404 if the specified project does not exist
* @return 404 if the specified load-test results do not exist
* @return 500 if internal error
*/
router.delete('/api/v1/projects/:id/metrics/:testRunTime', async function (req, res) {
  try {
    const projectID = req.sanitizeParams('id');
    const user = req.cw_user;
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      const message = `Unable to find project ${projectID}`;
      log.error(message);
      res.status(404).send({ message });
      return;
    }

    const testRunTime = req.sanitizeParams('testRunTime');
    await project.deleteMetrics(testRunTime);
    res.sendStatus(200);

  } catch (err) {
    log.error(err);
    if (err instanceof ProjectMetricsError && err.code === 'NOT_FOUND') {
      res.status(404).send(err.info || err);
    } else {
      res.status(500).send(err.info || err);
    }
  }
});

module.exports = router;
