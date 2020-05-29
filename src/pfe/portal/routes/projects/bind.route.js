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
const cwUtils = require('../../modules/utils/sharedFunctions');
const Logger = require('../../modules/utils/Logger');
const Project = require('../../modules/Project');
const metricsService = require('../../modules/metricsService');
const ProjectInitializerError = require('../../modules/utils/errors/ProjectInitializerError');
const { ILLEGAL_PROJECT_NAME_CHARS } = require('../../config/requestConfig');
const router = express.Router();
const log = new Logger(__filename);
const { validateReq } = require('../../middleware/reqValidator');
const { recursivelyListFilesOrDirectories } = require('../../modules/utils/sharedFunctions');

let timerbindstart = 0;
let timerbindend = 0;
let timersyncstart = 0;
let timersyncend = 0;

/**
 * API Function to begin binding a given project that is not currently
 * on a file system visible to Codewind.
 * @param name the name of the project to open
 * @param language the project language (e.g. java|nodejs|swift)
 * @param projectType the project type for the project, required
 * @param path the path to the project on disk
 * @return 202 if project directory was successfully bound as a codewind project
 * @return 400 if there was an error in the parameters
 * @return 409 if the project path or name are already in use
 * @return 500 if there was an error
 */
router.post('/api/v1/projects/bind/start', validateReq, bindStart);

async function bindStart(req, res) {
  timerbindstart = Date.now();
  let newProject;
  const user = req.cw_user;
  try {
    // Null checks on required parameters are done by validateReq.
    const name = req.sanitizeBody('name');
    const language = req.sanitizeBody('language');
    const projectType = req.sanitizeBody('projectType');
    const locOnDisk = req.sanitizeBody('path');
    const creationTime = req.sanitizeBody('creationTime')

    const illegalNameChars = ILLEGAL_PROJECT_NAME_CHARS.filter(char => name.includes(char));
    if (illegalNameChars.length > 0) {
      throw new ProjectInitializerError('INVALID_PROJECT_NAME', `invalid characters : ${JSON.stringify(illegalNameChars)}`);
    }

    const projectList = user.projectList.getAsArray();
    const nameUsed = projectList.some((project) => project.name == name);
    if (nameUsed) {
      const msg = `project name ${name} is already in use`;
      res.status(409).send(msg);
      log.warn(msg);
      return;
    }

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
      directory: name,
      workspace: global.codewind.CODEWIND_WORKSPACE,
      language: language,
      autoBuild: true,
      locOnDisk: locOnDisk,
      state: Project.STATES.closed,
    };

    if (creationTime) {
      projectDetails.creationTime = creationTime;
    }

    if (projectType) {
      projectDetails.projectType = projectType
      // If the project type is an extension, add the extension
      let extension = user.extensionList.getExtensionForProjectType(projectType);
      if (extension) {
        projectDetails.extension = extension;
        if (extension.config.needsMount && !global.codewind.RUNNING_IN_K8S)
          projectDetails.workspace = global.codewind.MOUNTED_WORKSPACE;
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
      res.status(500).send(`Project bind failed ${err.info || err}`);
    }
    log.error(err);
    return;
  }

  try {
    let tempDirName = path.join(global.codewind.CODEWIND_WORKSPACE, global.codewind.CODEWIND_TEMP_WORKSPACE);
    let dirName = newProject.projectPath();
    await fs.mkdir(dirName);
    let tempProjPath = path.join(tempDirName, newProject.name);
    await fs.mkdir(tempProjPath);

    newProject.workspaceDir = dirName;
    log.debug(`Creating directory in ${dirName} and ${tempDirName}`);
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
}

/**
 * API Function to receive gzipped content of a file, and write this to codewind-workspace
 * @param id the id of the project
 * @param path the path of the file, relative to the project directory
 * @param msg the gzipped file content
 * @param mode the permissions for the uploaded file
 * @return 200 if file upload is successful
 * @return 404 if project doesn't exist
 * @return 500 if internal error
 */
router.put('/api/v1/projects/:id/upload', validateReq, uploadFile);

async function uploadFile(req, res) {
  if (timersyncstart == 0) {
    timersyncstart = Date.now();
  }
  const projectID = req.sanitizeParams('id');
  const user = req.cw_user;
  try {
    const relativePathOfFile = req.sanitizeBody('path');
    const mode = req.sanitizeBody('mode');
    const project = user.projectList.retrieveProject(projectID);
    if (project) {
      // req.body.msg is gzipped, therefore sanitization is not required and may modify a users files
      const zippedFile = buffer.Buffer.from(req.body.msg, "base64"); // eslint-disable-line microclimate-portal-eslint/sanitise-body-parameters
      const unzippedFile = await inflateAsync(zippedFile);
      const pathToWriteTo = path.join(global.codewind.CODEWIND_WORKSPACE, global.codewind.CODEWIND_TEMP_WORKSPACE, project.name, relativePathOfFile)
      await fs.outputFile(pathToWriteTo, unzippedFile);
      if( mode !== undefined ) {
        await fs.chmod(pathToWriteTo, mode);
      }

      // if the project container has started, send the uploaded file to it
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch(err) {
    log.error(err);
    res.status(500).send(err);
  }
}

/**
 * API Function to clear the contents of a project ready
 * for upload of changed source.
 * @param id the id of the project
 * @param fileList a list of files that should be present in the project.
 * @param modifiedList a list of files that have been changed.
 * @param timestamp time since epoch when last sync was done.
 * @return 200 if the clear is successful
 * @return 404 if project doesn't exist
 * @return 500 if internal error
 */
router.post('/api/v1/projects/:id/upload/end', validateReq, uploadEnd);

async function uploadEnd(req, res) {
  const projectID = req.sanitizeParams('id');
  const keepFileList = req.sanitizeBody('fileList') || [];
  const keepDirList = req.sanitizeBody('directoryList') || [];
  const modifiedList = req.sanitizeBody('modifiedList') || [];
  const timeStamp = req.sanitizeBody('timeStamp');
  const IFileChangeEvent = [];
  const user = req.cw_user;
  
  let project;
  let pathToTempProj;
  let directoriesToDelete;
  let filesToDelete;
  
  try {
    project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.sendStatus(404);
      return;
    }
      
    pathToTempProj = path.join(global.codewind.CODEWIND_WORKSPACE, global.codewind.CODEWIND_TEMP_WORKSPACE, project.name);
    const tempProjectExists = await fs.pathExists(pathToTempProj);
    if (modifiedList.length === 0 && !tempProjectExists) {
      log.info('Temporary project directory doesn\'t exist and modified list is empty, not syncing any files');
      res.status(404).send('No files have been synced');
      return;
    }
    const pathToProj = project.projectPath();

    // Delete by directory
    const currentDirectoryList = await recursivelyListFilesOrDirectories(true, pathToTempProj);
    directoriesToDelete = await getPathsToDelete(currentDirectoryList, keepDirList);
    if (directoriesToDelete.length > 0) {
      // Get the highest level directory
      const topLevelDirectories = getTopLevelDirectories(directoriesToDelete);
      log.info(`Removing locally deleted directories from project: ${project.name}, ID: ${project.projectID} - ` +
      `${topLevelDirectories.join(', ')}`);
      await deletePathsInArray(pathToTempProj, topLevelDirectories);
      await deletePathsInArray(pathToProj, topLevelDirectories);
    }

    // Delete by file
    const currentFileList = await recursivelyListFilesOrDirectories(false, pathToTempProj);
    filesToDelete = await getPathsToDelete(currentFileList, keepFileList);
    if (filesToDelete.length > 0) {
      log.info(`Removing locally deleted files from project: ${project.name}, ID: ${project.projectID} - ` +
      `${filesToDelete.join(', ')}`);
      await deletePathsInArray(pathToTempProj, filesToDelete);
      // remove the files from pfe container
      await deletePathsInArray(pathToProj, filesToDelete);
    }

    res.sendStatus(200);
    
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
    return;
  }
      
  try {
    const wasProjectChanged = directoriesToDelete.length > 0
      || filesToDelete.length > 0
      || modifiedList.length > 0;
    if (wasProjectChanged) {
      const projectPath = project.projectPath();
      await cwUtils.copyProject(pathToTempProj, projectPath, getMode(project));

      if (project.injectMetrics) {
        try {
          // We will have replaced any injected files with their original version when we did
          // cwUtils.copyProject above. We must re-inject metrics here before building.
          await metricsService.injectMetricsCollectorIntoProject(project.projectType, project.language, projectPath);
        } catch (error) {
          log.warn(error);
        }
      }
      await syncToBuildContainer(project, filesToDelete, modifiedList, timeStamp, IFileChangeEvent, user, projectID);
      timersyncend = Date.now();
      let timersynctime = (timersyncend - timersyncstart) / 1000;
      log.info(`Total time to sync project ${project.name} to build container is ${timersynctime} seconds`);
      timersyncstart = 0;
    }

    let updatedProject = {
      projectID,
      creationTime: timeStamp,
    }
    await user.projectList.updateProject(updatedProject);

  } catch (err) {
    log.error(err);
  }
}

function getPathsToDelete(existingPathArray, newPathArray) {
  const pathsToDeleteSet = new Set(existingPathArray);
  newPathArray.forEach((f) => pathsToDeleteSet.delete(f));
  return Array.from(pathsToDeleteSet);
}

function getTopLevelDirectories(directoryArray) {
  let topLevelDirArray = [];
  directoryArray.forEach(dir => {
    const existingTopLevelDirectories = topLevelDirArray.filter(rootDirectory => isSubdirectory(dir, rootDirectory));
    if (existingTopLevelDirectories.length === 0) {
      // if there are subdirectories of "dir" already in the topLevelDirArray remove them
      topLevelDirArray = topLevelDirArray.filter(finalDir => !isSubdirectory(finalDir, dir));
      topLevelDirArray.push(dir);
    }
  });
  return topLevelDirArray;
}

function isSubdirectory(dir1, dir2) {
  // returns true if dir2 is a subdirectory of dir1 or they are the same
  const string = path.normalize(dir1 + '/');
  const prefix = path.normalize(dir2 + '/');
  return string.startsWith(prefix);
}

function deletePathsInArray(directory, arrayOfFiles) {
  const promiseArray = arrayOfFiles.map(filePath => {
    return cwUtils.forceRemove(path.join(directory, filePath));
  });
  return Promise.all(promiseArray);
}

function getMode(project) {
  return (project.extension && project.extension.config.needsMount) ? "777" : "";
}

async function syncToBuildContainer(project, filesToDelete, modifiedList, timeStamp, IFileChangeEvent, user, projectID) {
  // If the current project is being built, we do not want to copy the files as this will
  // interfere with the current build
  if (project.buildStatus != "inProgress" && project.loadRunner.isIdle()) {
    const globalProjectPath = project.projectPath();
    // We now need to remove any files that have been deleted from the global workspace
    await Promise.all(filesToDelete.map(oldFile => cwUtils.forceRemove(path.join(globalProjectPath, oldFile))));
    let projectRoot = cwUtils.getProjectSourceRoot(project);
    // need to delete from the build container as well
    if (!global.codewind.RUNNING_IN_K8S && project.projectType != 'docker' &&
      (!project.extension || !project.extension.config.needsMount)) {
      await Promise.all(filesToDelete.map(file => cwUtils.deleteFile(project, projectRoot, file)));
      log.info(
        `Project ${project.name} syncing with build container, projectRoot is ${projectRoot}`
      );
      if (project.containerId !== undefined) {
        try {
          await cwUtils.copyProjectContents(
            project,
            globalProjectPath,
            projectRoot
          );
        } catch (err) {
          // If we fail to copy into the container we still need to send the rest of the file change notifications.
          log.warn(`Failed to copyProjectContents for ${project.name} to ${project.containerId} - container may be stopped or removed.`);
        }
      } else {
        log.info(`Project ${project.name} - no container available to sync to.`);
      }
    }
    if (filesToDelete != undefined) {
      filesToDelete.forEach((f) => {
        const data = {
          path: f,
          timestamp: timeStamp,
          type: "DELETE",
          directory: false
        };
        IFileChangeEvent.push(data);
      });
    }
    if (modifiedList != undefined) {
      modifiedList.forEach((f) => {
        const data = {
          path: f,
          timestamp: timeStamp,
          type: "MODIFY",
          directory: false
        };
        IFileChangeEvent.push(data);
      });
    }
    user.fileChanged(projectID, timeStamp, 1, 1, IFileChangeEvent);
  } else {
    // if a build or loadrun is in progress, wait 5 seconds and try again
    await cwUtils.timeout(5000)
    await syncToBuildContainer(project, filesToDelete, modifiedList, timeStamp, IFileChangeEvent, user, projectID);
  }
}

/**
 * API Function to complete binding a given project on a file system visible
 * to Codewind once source file upload is complete.
 * @param id the id of the project
 * @return 202 if project directory was successfully bound as a codewind project
 * @return 404 if the project was not found
 * @return 500 if there was an error
 */
router.post('/api/v1/projects/:id/bind/end', validateReq, bindEnd);

async function bindEnd(req, res) {
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
    const pathToCopy = path.join(global.codewind.CODEWIND_WORKSPACE, global.codewind.CODEWIND_TEMP_WORKSPACE, project.name);
    // now move temp project to real project
    await cwUtils.copyProject(pathToCopy, project.projectPath(), getMode(project));

    try {
      // Now the files are in the container check whether it is an OpenLiberty project
      await project.setOpenLiberty();
      if (project.injectMetrics) {
        await metricsService.injectMetricsCollectorIntoProject(project.projectType, project.language, project.projectPath());
      }
    } catch (error) {
      log.warn(error);
    }

    try {
      // Set the initial metrics state for the project (updates the file system)
      await project.setMetricsState();
    } catch(setMetricsStateErr) {
      log.warn(`error updating the metrics state for ${updatedProject.name}, Error: ${setMetricsStateErr}`);
    }

    // debug logic to identify bind time
    timerbindend = Date.now();
    let totalbindtime = (timerbindend - timerbindstart) / 1000;
    log.info(`Total time to bind project ${project.name} is ${totalbindtime} seconds`);
    timersyncstart = 0;

    let updatedProject = {
      projectID,
      state: Project.STATES.open,
      startMode: 'run', // always use 'run' mode for new or recently re-opened projects
    }
    user.uiSocket.emit('projectStatusChanged', updatedProject);
    await user.projectList.updateProject(updatedProject);
    await user.buildAndRunProject(project);

    res.status(200).send(project);
    const projectInfoForUI = project.toJSON()
    user.uiSocket.emit('projectBind', { status: 'success', ...projectInfoForUI });
    log.info(`Successfully created project - name: ${project.name}, ID: ${project.projectID}`);

  } catch (err) {
    log.error(`Project creation failed for project ${project.name}. Error: ${util.inspect(err)}`);
    const data = {
      name: project.name,
      projectID: project.projectID,
      status: 'failed',
      error: err.info || err
    }
    user.uiSocket.emit('projectBind', data);

    res.status(500).send(data.error);
    await user.deleteProjectFiles(project);
  }
}

/**
 * API Function to unbind a given project
 * @param id, the id of the project to delete
 * @return 202 if project deletion was accepted
 * @return 404 if the project with id was not found
 * @return 409 if unbind was already in progress
 */
router.post('/api/v1/projects/:id/unbind', validateReq, unbind);

async function unbind(req, res) {
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
}

/**
 * API Function to return an array of files the given project contains
 * @param id, the id of the project
 * @return 200 if the action was successful
 * @return 404 if the project with id was not found
 */

router.get('/api/v1/projects/:id/fileList', validateReq, async (req, res) => {
  const user = req.cw_user;
  const projectID = req.sanitizeParams('id');
  let project;
  try {
    project = user.projectList.retrieveProject(projectID);
    if (!project) {
      res.status(404).send(`Unable to find project ${projectID}`);
      return;
    }
    const pathToTempProj = path.join(global.codewind.CODEWIND_WORKSPACE, global.codewind.CODEWIND_TEMP_WORKSPACE, project.name);
  
    const files  = await recursivelyListFilesOrDirectories(false, pathToTempProj);
    res.status(200).send(files);
  } catch (err) {
    log.error(err.info || err);
    res.status(500).send(err.info || err);
  }

});

module.exports = router;
