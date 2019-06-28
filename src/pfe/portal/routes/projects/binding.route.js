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
const path = require('path');
const util = require('util');

const Logger = require('../../modules/utils/Logger');
const Project = require('../../modules/Project');
const ProjectInitializerError = require('../../modules/utils/errors/ProjectInitializerError');
const { ILLEGAL_PROJECT_NAME_CHARS } = require('../../config/requestConfig');
const router = express.Router();
const log = new Logger(__filename);
const { validateReq } = require('../../middleware/reqValidator');

/**
 * API Function to bind a given project
 * @param name the name of the project to open
 * @param path the absolute path on the file system to the project
 * @param language the project language (e.g. java|nodejs|swift)
 * @param projectType the project type for the project, required
 * @param autoBuild whether the project should be built automatically (optional, default true)
 * @return 202 if project directory was successfully bound as a codewind project
 * @return 400 if there was an error in the parameters
 * @return 409 if the project path or name are already in use
 * @return 500 if there was an error
 */
router.post('/api/v1/projects/bind', validateReq, async function (req, res) {
  let newProject;
  const user = req.cw_user;
  try {
    // Null checks on required parameters are done by validateReq.
    const projectPath = req.sanitizeBody('path');
    const name = req.sanitizeBody('name');
    const language = req.sanitizeBody('language');
    const projectType = req.sanitizeBody('projectType');
    const autoBuildParam = req.sanitizeBody('autoBuild');
    const projectList = user.projectList.getAsArray();

    const illegalNameChars = ILLEGAL_PROJECT_NAME_CHARS.filter(char => name.includes(char));
    if (illegalNameChars.length > 0) {
      throw new ProjectInitializerError('INVALID_PROJECT_NAME', `invalid characters : ${JSON.stringify(illegalNameChars)}`);
    }

    // Check the path is absolute, relative paths have no meaning since we are
    // inside a container they can't be relative to our current directory.
    if (!path.isAbsolute(projectPath)) {
      const msg = 'Path to project must be an absolute path';
      res.status(400).send(msg);
      log.warn(msg);
      return;
    }

    // Query all projects and make sure this is not already bound.
    const projectAlreadyBound = projectList.some((project) => path.join(project.workspace, project.directory) == projectPath);
    if (projectAlreadyBound) {
      const msg = 'path is already bound to a project';
      res.status(409).send(msg);
      log.warn(msg);
      return;
    }

    const nameUsed = projectList.some((project) => project.name == name);
    if (nameUsed) {
      const msg = `name ${name} is already bound to a project`;
      res.status(409).send(msg);
      log.warn(msg);
      return;
    }

    // Workspace should have trailing separator.
    const workspaceDir = path.dirname(projectPath) + path.sep;
    const projectDir = path.basename(projectPath)
    // Autobuild should default to true, which means if it's unset we
    // don't want to convert that to false.
    const autoBuild = autoBuildParam === false ? false : true;
    const validProjectTypes = await user.projectTypes();

    if (!validProjectTypes.includes(projectType)) {
      // If projectType is undefined or unknown we will reject it.
      const msg = `projects must specify a valid project type`;
      res.status(400).send(msg);
      log.warn(msg);
      return;
    }

    const projectDetails = {
      name: name,
      directory: projectDir,
      workspace: workspaceDir,
      language: language,
      autoBuild: autoBuild,
    };

    if (projectType) {
      projectDetails.projectType = projectType
      // If the project type is an extension, add the extension
      let extension = user.extensionList.getExtensionForProjectType(projectType);
      if (extension) {
        projectDetails.extension = extension;
      }
    }

    newProject = await user.createProject(projectDetails);
    let msg = `Project ${newProject.name} (${newProject.projectID}) opened.`;
    if (autoBuild) {
      msg += ' Will build and run.';
    }
    res.status(202).send(newProject);
    log.info(msg);
  } catch (err) {
    if (err.code === 'INVALID_PROJECT_NAME'){
      res.status(400).send(err.info);
    } else {
      res.sendStatus(500);
    }
    log.error(err);
    return;
  }

  try {
    if (newProject.autoBuild) {
      await user.buildAndRunProject(newProject);
    }
    user.uiSocket.emit('projectBind', { status: 'success', ...newProject });
    log.info(`Successfully created project - name: ${newProject.name}, ID: ${newProject.projectID}`);
  } catch (err) {
    log.error(`Project creation failed for project ${newProject.name}. Error: ${util.inspect(err)}`);
    const data = {
      name: newProject.name,
      projectID: newProject.projectID,
      status: 'failed',
      error: err.info || err
    }
    user.uiSocket.emit('projectBind', data);
  }
});

/**
 * API Function to unbind a given project
 * @param id, the id of the project to delete
 * @return 202 if project deletion was accepted
 * @return 404 if the project with id was not found
 * @return 409 if unbind was already in progress
 */
router.post('/api/v1/projects/:id/unbind', validateReq, async function (req, res) {
  const user = req.cw_user;
  // Null checks on projectID done by validateReq.
  const projectID = req.sanitizeParams('id');
  try {
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
    } else if (project.isDeleting()) {
      res.status(409).send(`Delete for project ${projectID} already requested`);
    } else {
      // Set an action of deleting
      await user.projectList.updateProject({
        projectID: projectID,
        action: Project.STATES.deleting,
      });
      res.status(202).send(`Project ${projectID} delete request accepted`);
      log.debug(`Requesting deletion of project ${project.name} (${projectID})`);
      await user.unbindProject(project);
    }
  } catch (err) {
    const data = {
      projectID,
      status: 'failed',
      error: err.message
    }
    user.uiSocket.emit('projectDeletion', data);
    log.error(`Error deleting project: ${util.inspect(data)}`);
  }
});

module.exports = router;
