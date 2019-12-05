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
const path = require('path');

const metricsService = require('../modules/metricsService');
const Logger = require('../modules/utils/Logger');
const cwUtils = require('../modules/utils/sharedFunctions');

const log = new Logger(__filename);

/**
 * Enable or disable the auto injection of metrics collector
 * @param project, the project
 * @return 202 if the specified setting was applied and build requested
 * @return 404 if the specified project does not exist
 * @return 500 if internal error
 */
async function inject(req, res) {
  try {
    const projectID = req.sanitizeParams('id');
    const injectMetrics = req.sanitizeBody('enable');
    const user = req.cw_user;
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      const message = `Unable to find project ${projectID}`;
      log.error(message);
      res.status(404).send(message);
      return;
    }

    const projectDir = path.join(project.workspace, project.directory);
    if (injectMetrics) {
      await metricsService.injectMetricsCollectorIntoProject(project.projectType, projectDir);
    } else {
      await metricsService.removeMetricsCollectorFromProject(project.projectType, projectDir);
    }

    await user.projectList.updateProject({
      projectID: projectID,
      injectMetrics: injectMetrics
    });

    res.sendStatus(202);

    await syncProjectFilesIntoBuildContainer(project, user);
  } catch (err) {
    log.error(err);
    res.status(500).send(err.info || err.message);
  }
}

async function syncProjectFilesIntoBuildContainer(project, user){
  const globalProjectPath = path.join(project.workspace, project.name);
  const projectRoot = cwUtils.getProjectSourceRoot(project);
  if (project.buildStatus != "inProgress") {
    await cwUtils.copyProjectContents(
      project,
      globalProjectPath,
      projectRoot
    );
    await user.buildProject(project, "build");
  } else {
    // if a build is in progress, wait 5 seconds and try again
    await cwUtils.timeout(5000)
    await syncProjectFilesIntoBuildContainer(project, user);
  }
}

module.exports = {
  inject,
}
