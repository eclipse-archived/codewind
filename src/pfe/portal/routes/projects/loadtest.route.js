
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
const fs = require('fs-extra');
const {JSONPath} = require('jsonpath-plus');
const path = require('path');
const queryString = require('query-string');

const Logger = require('../../modules/utils/Logger');
const LoadRunError = require('../../modules/utils/errors/LoadRunError');
const { validateReq } = require('../../middleware/reqValidator');

const router = express.Router();
const log = new Logger(__filename);

/**
  * API function to run load against a given project
  * @param req, the request from the UI containing project id
  * @returns status code handled and passed back from the loadrunner
  * 202 on success, 404 if project id does not exist, 400 if options are invalid or a run
  * is already in progress, 500 if error
  */
router.post('/api/v1/projects/:id/loadtest', validateReq, async function(req,res){
  const user = req.cw_user;
  const projectID = req.sanitizeParams('id');
  let project = user.projectList.retrieveProject(projectID);
  let description = req.sanitizeBody('description');
  if (!project) {
    res.status(404).send(`Unable to find project ${projectID}`);
  } else {

    try {
      if ( !project.ports || project.state !== 'open' ) {
        throw new LoadRunError("PROJECT_NOT_OPEN", `For project (${project.projectID})`);
      } else if ( project.appStatus !== 'started' ) {
        throw new LoadRunError(LoadRunError.PROJECT_NOT_RUNNING, `For project (${project.projectID})`);
      }
    } catch (err) {
      res.status(503).send(err.info);
      return;
    }

    log.info(`LoadTest route: loadInProgress= ${project.loadInProgress}`);
    if (project.loadInProgress == true) {
      const err = new LoadRunError("RUN_IN_PROGRESS", `For project ${project.projectID}`);
      res.status(409).send(err.info || err);
      return;
    }

    try {
      await user.runLoad(project, description);
    } catch(err) {
      log.error(err);
      if (err.code == LoadRunError.RUN_IN_PROGRESS) {
        res.status(409).send(err.info || err);
        return
      }
      res.status(500).send(err.info || err);
    }
    res.status(202).send("");
  }
});

/**
* API function to cancel load against a given project
* @param req, the request from the UI containing project id
* @returns status code handled and passed back from the loadrunner
* 200 on success, 404 if project id does not exist,409 no load
* being run on that given project, 500 if error
*/
router.post('/api/v1/projects/:id/loadtest/cancel', async function(req,res){
  let user = req.cw_user;
  const projectID = req.sanitizeParams('id');
  let project = user.projectList.retrieveProject(projectID);

  if (!project) {
    res.status(404).send(`Unable to find project ${projectID}`);
  } else {
    try {
      let cancelLoadResp = await user.cancelLoad(project);
      // Response logic completed in ..docker/loadrunner/server.js
      res.status(cancelLoadResp.statusCode).send(cancelLoadResp.body);
    } catch(err) {
      log.error(err);
      if (err.code == LoadRunError.NO_RUN_IN_PROGRESS) {
        res.status(409).send(err.info);
      } else {
        res.status(500).send(err.info || err);
      }
    }
  }
});


/**
 * Function to read the load-test/config.json for a project
 * @param id, the id of the project
 * @return 200 if project existed and the load-test/config.json file is found
 * @return 400 if input is invalid
 * @return 404 if project is not found
 * @return 500 on internal error
 */

router.get('/api/v1/projects/:id/loadtest/config', validateReq, async function (req, res) {
  try {
    const user = req.cw_user;
    const projectID = req.sanitizeParams('id');
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
      return;
    }
    const config  = await project.getLoadTestConfig();
    res.status(200).send(config);
  } catch (err) {
    log.error(err.info || err);
    res.status(500).send(err.info || err);
  }
});

/**
 * Function to write the load-test/config.json for a project.
 * @param id, the id of the project
 * @return 200 if project existed and the load-test/config.json file is written successfully
 * @return 400 if input is invalid
 * @return 404 if project is not found
 * @return 500 on internal error
 */

router.post('/api/v1/projects/:id/loadtest/config', validateReq, async function (req, res) {
  try {
    let configOptions = {};
    const user = req.cw_user;
    const expectedConfigFields = ['path', 'requestsPerSecond', 'concurrency', 'maxSeconds', 'body', 'method'];
    const projectID = req.sanitizeParams('id');
    const queryParams = req.sanitizeBody('query')
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
      return;
    }
    for (const key in req.body) {
      if (expectedConfigFields.includes(key)) configOptions[key] = req.sanitizeBody(key);
    }
    // Process query-parameters, if they are given, and then add to the path
    if (queryParams && Object.keys(queryParams).length > 0) {
      const fullQueryString = queryString.stringify(queryParams);
      configOptions.path = `${configOptions.path}?${fullQueryString}`;
    }
    if (!path.isAbsolute(configOptions.path)) {
      res.status(400).send('Path must be absolute');
      return;
    }

    // Process body and add contentType (JSON)
    if (configOptions["body"]) {
      configOptions.contentType="application/json";
      try {
        configOptions.body = JSON.parse(configOptions["body"]);
      } catch (err) {
        log.error("Body parse failed");
      }
    } else {
      delete configOptions.body;
    }
    await project.writeNewLoadTestConfigFile(configOptions);
    res.status(200).json(`load-test/config.json successfully written to project ${project.name}`);
  } catch (err) {
    log.error(err.info || err);
    res.status(500).send(err.info || err);
  }
});

/**
 * Function to read the profiling data for a given project and test time
 * @param id, the id of the project
 * @param testRunTime, the timestamp of the load runner test
 * @return 200 if project existed and the profiling data was found
 * @return 400 if input is invalid
 * @return 404 if project is not found
 * @return 500 on internal error
 */

router.get('/api/v1/projects/:id/profiling/:testRunTime', validateReq, async function (req, res) {
  try {
    const user = req.cw_user;
    const projectID = req.sanitizeParams('id');
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
      return;
    }
    const testRunTime = req.sanitizeParams('testRunTime');
    const profilingStream = await project.getProfilingByTime(testRunTime);
    res.status(200)
    profilingStream.on('end', () => res.end());
    profilingStream.pipe(res);
  } catch (err) {
    log.error(err.info || err);
    res.status(500).send(err.info || err);
  }
});

router.post('/api/v1/projects/:id/profiling/:testRunTime/querytree', validateReq, async function (req, res) {
  try {
    const user = req.cw_user;
    const projectID = req.sanitizeParams('id');
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
      return;
    }
    const testRunTime = req.sanitizeParams('testRunTime');
    const profilingTreeFile = await project.getPathToProfilingTreeFile(testRunTime);
    if (!await fs.pathExists(profilingTreeFile)) {
      res.status(404).send(`Unable to find profiling tree for ${testRunTime}`);
      return;
    }
    // eslint-disable-next-line microclimate-portal-eslint/sanitise-body-parameters
    const path = req.body['path'];
    const options = {
      wrap: false,
    }
    const profilingTree = await fs.readJSON(profilingTreeFile);
    const result = JSONPath({options, path, json: profilingTree});
    res.status(200).send(result);
  } catch (err) {
    log.error(err.info || err);
    res.status(500).send(err.info || err);
  }
});

router.post('/api/v1/projects/:id/profiling/:testRunTime/querysummary', validateReq, async function (req, res) {
  try {
    const user = req.cw_user;
    const projectID = req.sanitizeParams('id');
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
      return;
    }
    const testRunTime = req.sanitizeParams('testRunTime');
    const profilingSummaryFile = await project.getPathToProfilingSummaryFile(testRunTime);
    if (!await fs.pathExists(profilingSummaryFile)) {
      res.status(404).send(`Unable to find profiling summary for ${testRunTime}`);
      return;
    }
    // eslint-disable-next-line microclimate-portal-eslint/sanitise-body-parameters
    const path = req.body['path'];
    const options = {
      wrap: false,
    }
    const profilingTree = await fs.readJSON(profilingSummaryFile);
    const result = JSONPath({options, path, json: profilingTree});
    res.status(200).send(result);
  } catch (err) {
    log.error(err.info || err);
    res.status(500).send(err.info || err);
  }
});

module.exports = router;
