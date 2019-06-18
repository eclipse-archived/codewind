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
const path = require('path');
const { validateReq } = require('../../middleware/reqValidator');

// Use logger here as 'log' is a poor choice of name in this
// file.
const logger = new Logger(__filename);
const router = express.Router();

const CONTAINER_LOG_TYPE = 'app';
const CONTAINER_LOG_NAME = '-';

/**
 * API Function to list all streamable logs for a given project
 * @param id, the project id to list logs for
 */
router.get('/api/v1/projects/:id/logs', validateReq, (req, res) => startStreamingAll(req, res, false));

/**
 * API Function to start streaming all logs for a given project
 * @param id, the project id to stream logs for
 */
router.post('/api/v1/projects/:id/logs', validateReq, (req, res) => startStreamingAll(req, res, true));

async function startStreamingAll(req, res, startStreams) {
  let projectID = req.sanitizeParams('id');
  try {
    let user = req.mc_user;
    let project = user.projectList.retrieveProject(projectID);
    if (project) {
      let logs = await user.getProjectLogs(project);
      let logTypes = {};
      for (let logType of Object.keys(logs)) {
        logTypes[logType] = [];
        for (let file of logs[logType].files) {
          let logName = path.basename(file);
          let logObject = {logName: logName}
          if (logs[logType].origin == 'workspace') {
            logObject.workspaceLogPath = path.dirname(file);
          }
          logTypes[logType].push(logObject);
          let logFile = file;
          let logOrigin = logs[logType].origin;
          if (startStreams) {
            project.startStreamingLog(user.uiSocket, logType, logOrigin, logName, logFile);
          }
        }
      }
      let container = project.containerId || project.podName;
      if (container && container !== '') {
        if (!logTypes[CONTAINER_LOG_TYPE]) {
          logTypes[CONTAINER_LOG_TYPE] = [];
        }
        // Use '-' for stdout (ie the container log).
        logTypes[CONTAINER_LOG_TYPE].push({logName: '-'});
        if (startStreams) {
          project.startStreamingLog(user.uiSocket, CONTAINER_LOG_TYPE, 'container', CONTAINER_LOG_NAME, CONTAINER_LOG_NAME);
        }
      }
      res.status(200).send(logTypes);
    } else {
      logger.error(`Logs requested for unknown project ${projectID}`);
      res.sendStatus(404);
    }
  } catch (error) {
    logger.error(error);
    res.status(500).send(error);
  }
}

/**
 * API Function to stop streaming all logs for a given project
 * @param id, the project id to stop streaming logs for
 */
router.delete('/api/v1/projects/:id/logs', validateReq, function stopStreamingAll(req, res) {
  let projectID = req.sanitizeParams('id');
  try {
    let user = req.mc_user;
    let project = user.projectList.retrieveProject(projectID);
    if (project) {
      // Ask the project to stop streaming all logs.
      project.stopStreamingAllLogs();
      logger.info(`Stopped streaming logs for ${projectID}`);
      res.sendStatus(200);
    } else {
      logger.error(`Logs stream stop for unknown project ${projectID}`);
      res.sendStatus(404);
    }
  } catch (error) {
    logger.error(error);
    res.status(500).send(error);
  }
});

/**
 * API Function to start streaming a log for a given project
 * @param id, the project id to stream a logs
 * @param type, the type of the log (build or app)
 * @param name, the name of the log
 */
router.post('/api/v1/projects/:id/logs/:type/:name', validateReq, async function startStreaming(req, res) {
  let projectID = req.sanitizeParams('id');
  let logType = req.sanitizeParams('type');
  let logName = req.sanitizeParams('name');
  try {
    let logFile;
    let logOrigin;
    let user = req.mc_user;
    let project = user.projectList.retrieveProject(projectID);
    if (project) {
      if (logName == CONTAINER_LOG_NAME && logType == CONTAINER_LOG_TYPE) {
        let container = project.containerId || project.podName;
        if (container && container !== '') {
          logFile = CONTAINER_LOG_NAME;
          logOrigin = 'container';
        }
      } else {
        let logs = await user.getProjectLogs(project);
        if (logs && logs[logType]) {
          // Stream log depending on whether it's a file visible to portal or only
          // in the container.
          for (let file of logs[logType].files) {
            if (logName === path.basename(file)) {
              logFile = file;
              logOrigin = logs[logType].origin;
            }
          }
        }
      }
      if (logFile) {
        project.startStreamingLog(user.uiSocket, logType, logOrigin, logName, logFile);
        res.sendStatus(200);
      } else {
        logger.error(`log stream could not be created, no ${logName} log file of type ${logType} for project ${project.name}`);
        res.sendStatus(404);
      }
    } else {
      logger.error("log stream could not be created, " + projectID + " does not exist");
      res.sendStatus(404);
    }
  } catch (error) {
    logger.error(error);
    res.status(500).send(error);
  }
});

/**
 * API Function to stop streaming a log for a given project
 * @param id, the project id to stream a logs
 * @param type, the type of the log (build or app)
 * @param name, the name of the log
 */

router.delete('/api/v1/projects/:id/logs/:type/:name', validateReq, function stopStreaming(req, res) {
  let projectID = req.sanitizeParams('id');
  let logType = req.sanitizeParams('type');
  let logName = req.sanitizeParams('name');
  try {
    let user = req.mc_user;
    let project = user.projectList.retrieveProject(projectID);
    if (project) {
      project.stopStreamingLog(logType, logName);
      logger.info(`Stopped streaming log: ${logType} ${logName} for ${projectID}`);
      res.sendStatus(200);
    } else {
      logger.error("log stream could not be deleted, " + projectID + " does not exist");
      res.sendStatus(404);
    }
  } catch (error) {
    logger.error(error);
    res.status(500).send(error);
  }
});

module.exports = router;
