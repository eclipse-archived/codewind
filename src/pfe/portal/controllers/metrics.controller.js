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
const metricsService = require('../services/metricsService');
const Logger = require('../modules/utils/Logger');
const cwUtils = require('../modules/utils/sharedFunctions');
const { getProjectFromReq } = require('../middleware/checkProjectExists');
const ProjectMetricsError = require('../modules/utils/errors/ProjectMetricsError');

const log = new Logger(__filename);

/**
 * Enable or disable the auto injection of metrics collector
 * @param project, the project
 * @return 202 if the specified setting was applied and build requested
 * @return 404 if the specified project does not exist
 * @return 500 if internal error
 */
async function inject(req, res) {
  let project;
  let user;
  try {
    const projectID = req.sanitizeParams('id');
    const injectMetrics = req.sanitizeBody('enable');
    user = req.cw_user;
    project = user.projectList.retrieveProject(projectID);
    if (!project) {
      const message = `Unable to find project ${projectID}`;
      log.error(message);
      res.status(404).send(message);
      return;
    }

    const projectDir = project.projectPath();
    if (injectMetrics) {
      await metricsService.injectMetricsCollectorIntoProject(project.projectType, project.language, projectDir);
    } else {
      await metricsService.removeMetricsCollectorFromProject(project.projectType, project.language, projectDir);
    }

    await user.projectList.updateProject({
      projectID: projectID,
      injectMetrics: injectMetrics
    });

    res.sendStatus(202);
  } catch (err) {
    log.error(err);
    res.status(500).send(err.info || err.message);
    return;
  }

  try {
    await syncProjectFilesIntoBuildContainer(project, user);
  } catch (err) {
    log.error(err);
  }
}

async function auth(req, res) {
  // Handle true as a string or boolean
  const disableMetricsAuth = req.sanitizeBody('disable') === 'true' || req.sanitizeBody('disable') === true;
  const user = req.cw_user;
  const project = getProjectFromReq(req);
  const { projectID, language, metricsCapabilities } = project;
  const projectDir = project.projectPath();

  const { microprofilePackageFoundInBuildFile, microprofilePackageAuthenticationDisabled } = project.getMetricsCapabilities();
  // If the project does not have the microprofile metrics found in its file system, this functionality is unsupported
  if (!microprofilePackageFoundInBuildFile) {
    const unsupportedError = new ProjectMetricsError('DISABLE_METRICS_AUTH_UNSUPPORTED', projectID, 'Project does not have microprofile metrics');
    log.error(unsupportedError);
    res.status(400).send(unsupportedError.message);
    return;
  }

  try {
    if (disableMetricsAuth) {
      if (microprofilePackageAuthenticationDisabled) {
        res.status(400).send('Metrics authentication is disabled');
        return;
      }
      await metricsService.disableMicroprofileMetricsAuth(language, projectDir);
    } else {
      if (!microprofilePackageAuthenticationDisabled) {
        res.status(400).send('Metrics authentication is not disabled');
        return;
      }
      await metricsService.enableMicroprofileMetricsAuth(language, projectDir);
    }

    await user.projectList.updateProject({
      projectID: projectID,
      metricsCapabilities: {
        ...metricsCapabilities,
        microprofilePackageAuthenticationDisabled: disableMetricsAuth,
      },
    });

    res.sendStatus(202);
  } catch (err) {
    log.error(err);
    if (err.code === ProjectMetricsError.CODES.DISABLE_METRICS_AUTH_UNSUPPORTED) {
      res.status(400).send(err.info || err.message);
    } else {
      res.status(500).send(err.info || err.message);
    }
    return;
  }

  try {
    await syncProjectFilesIntoBuildContainer(project, user);
  } catch (err) {
    log.error(err);
  }
}

async function syncProjectFilesIntoBuildContainer(project, user){
  const globalProjectPath = project.projectPath();
  const projectRoot = cwUtils.getProjectSourceRoot(project);
  if (project.buildStatus != "inProgress") {
    if (!global.codewind.RUNNING_IN_K8S && project.projectType != 'docker' &&
      (!project.extension || !project.extension.config.needsMount)) {
      await cwUtils.copyProjectContents(
        project,
        globalProjectPath,
        projectRoot
      );
    }
    await user.buildProject(project, "build");
  } else {
    // if a build is in progress, wait 5 seconds and try again
    await cwUtils.timeout(5000)
    await syncProjectFilesIntoBuildContainer(project, user);
  }
}

module.exports = {
  inject,
  auth,
}
