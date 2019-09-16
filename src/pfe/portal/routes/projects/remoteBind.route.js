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
const util = require('util');
const path = require('path');
const buffer = require('buffer');
const zlib = require("zlib");
const { promisify } = require('util');
const inflateAsync = promisify(zlib.inflate);
const exec = promisify(require('child_process').exec);

const Logger = require('../../modules/utils/Logger');
const ProjectInitializerError = require('../../modules/utils/errors/ProjectInitializerError');
const { ILLEGAL_PROJECT_NAME_CHARS } = require('../../config/requestConfig');
const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to begin binding a given project that is not currently
 * on a file system visible to Codewind.
 * @param name the name of the project to open
 * @param language the project language (e.g. java|nodejs|swift)
 * @param projectType the project type for the project, required
 * @return 202 if project directory was successfully bound as a codewind project
 * @return 400 if there was an error in the parameters
 * @return 409 if the project path or name are already in use
 * @return 500 if there was an error
 */
router.post('/api/v1/projects/remote-bind/start', async function (req, res) {
  let newProject;
  const user = req.cw_user;
  try {
    // Null checks on required parameters are done by validateReq.
    const name = req.sanitizeBody('name');
    const projectPath = req.sanitizeBody('path');
    const language = req.sanitizeBody('language');
    const projectType = req.sanitizeBody('projectType');

    const illegalNameChars = ILLEGAL_PROJECT_NAME_CHARS.filter(char => name.includes(char));
    if (illegalNameChars.length > 0) {
      throw new ProjectInitializerError('INVALID_PROJECT_NAME', `invalid characters : ${JSON.stringify(illegalNameChars)}`);
    }

    const validProjectTypes = await user.projectTypes();

    if (!validProjectTypes.includes(projectType)) {
      // If projectType is undefined or unknown we will reject it.
      const msg = `projects must specify a valid project type`;
      res.status(400).send(msg);
      log.warn(msg);
      return;
    }

    const workspaceDir = path.dirname(projectPath) + path.sep;
    const projectDir = path.basename(projectPath)

    const projectDetails = {
      name: name,
      directory: projectDir,
      workspace: workspaceDir,
      language: language,
      autoBuild: true
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
    let dirName = path.join(global.codewind.CODEWIND_WORKSPACE, newProject.name)
    log.debug(`Creating directory in ${dirName}`);
    await fs.mkdir(dirName);
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
 * API Function to receive gzipped content of a file, and write this to codewind-workspace
 * @param id the id of the project
 * @param path the path of the file, relative to the project directory
 * @param msg the gzipped file content
 * @return 200 if file upload is successful 
 * @return 404 if project doesn't exist
 * @return 500 if internal error
 */
router.put('/api/v1/projects/:id/remote-bind/upload', async (req, res) => {
  const projectID = req.sanitizeParams('id');
  const user = req.cw_user;
  try {
    const relativePathOfFile = req.sanitizeBody('path');
    const project = user.projectList.retrieveProject(projectID);
    if (project) {
      // req.body.msg is gzipped, therefore sanitization is not required and may modify a users files
      const zippedFile = buffer.Buffer.from(req.body.msg, "base64"); // eslint-disable-line microclimate-portal-eslint/sanitise-body-parameters
      const unzippedFile = await inflateAsync(zippedFile);
      const fileToWrite = JSON.parse(unzippedFile.toString());
      const pathToWriteTo = path.join(global.codewind.CODEWIND_WORKSPACE, project.name, relativePathOfFile)
      await fs.outputFile(pathToWriteTo, fileToWrite);
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    } 
  } catch(err) {
    log.error(err);
    res.status(500).send(err);
  }
});

/**
 * API Function to clear the contents of a project ready
 * for upload of changed source.
 * @param id the id of the project
 * @return 200 if the clear is successful
 * @return 404 if project doesn't exist
 * @return 500 if internal error
 */
// TODO - This is very crude, we should replace it with a more sophisticated
// mechanism to only delete files that don't exist on the local end.
router.post('/api/v1/projects/:id/remote-bind/clear', async (req, res) => {
  const projectID = req.sanitizeParams('id');
  const user = req.cw_user;
  try {
    const project = user.projectList.retrieveProject(projectID);
    if (project) {
      const pathToClear = path.join(global.codewind.CODEWIND_WORKSPACE, project.name);
      await exec(`rm -rf ${pathToClear}/* ${pathToClear}/.[!.]*`);
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch(err) {
    log.error(err);
    res.status(500).send(err);
  }
});

/**
 * API Function to complete binding a given project on a file system visible
 * to Codewind once source file upload is complete.
 * @param id the id of the project
 * @return 202 if project directory was successfully bound as a codewind project
 * @return 404 if the project was not found
 * @return 500 if there was an error
 */
router.post('/api/v1/projects/:id/remote-bind/end', async function (req, res) {
  const user = req.cw_user;
  // Null checks on projectID done by validateReq.
  const projectID = req.sanitizeParams('id');
  let project;
  try {
    project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
      return;
    }
    await user.buildAndRunProject(project);
    res.status(200).send(project);
    user.uiSocket.emit('projectBind', { status: 'success', ...project });
    log.info(`Successfully created project - name: ${project.name}, ID: ${project.projectID}`);
  } catch (err) {
    log.error(`Project creation failed for project ${project.name}. Error: ${util.inspect(err)}`);
    const data = {
      name: project.name,
      projectID: project.projectID,
      status: 'failed',
      error: err.info || err
    }
    res.status(500);
    user.uiSocket.emit('projectBind', data);
  }
});

module.exports = router;
