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

// TODO create the file watcher container in this file
const path = require('path');
const Project = require('./Project');
const Logger = require('./utils/Logger');
const FilewatcherError = require('./utils/errors/FilewatcherError');
const ProjectListError = require('./utils/errors/ProjectListError');
const WebSocket = require('./WebSocket');
const crypto = require('crypto');
const fw = require('file-watcher');
const log = new Logger('FileWatcher.js');
const filewatcher = new fw();

/**
 * The FileWatcher class
 * Contains functions to:
 *    - Listen to Socket message from the FileWatcher container
 *    - Reconnect to the FileWatcher if we disconnect or timeout
 * One per User
 */
module.exports = class FileWatcher {
  constructor(user) {
    this.user = user;
    this.up = false;
    this.registerFWListener();
  }

  registerFWListener() {
    this.up = true;
    if(this.locale) this.setLocale(this.locale);
    filewatcher.registerListener({
      name: "portalListener",
      handleEvent: async (event, fwProject) => {
        log.debug("Portal's event listener: " + event);
        log.debug("Portal's event listener: " + JSON.stringify(fwProject));
        switch (event) {
        case "projectCreation" : {
          await this.handleFWProjectEvent('projectCreation', fwProject);
          break;
        }

        case "projectSettingsChanged" : {
          logEvent("projectSettingsChanged", fwProject);
          if (fwProject.name == "ignoredPaths") {
            await this.handleFWProjectEvent("projectSettingsChanged", fwProject);
          }
          this.user.uiSocket.emit("projectSettingsChanged", fwProject);
          break;
        }

        case "projectDeletion" : {
          logEvent('projectDeletion', fwProject);
          // Delete properties that we don't want to store
          delete fwProject.operationId;
          try {
              // Retrieve the project information so we can decide how to handle this.
              let project = this.user.projectList.retrieveProject(fwProject.projectID);
              if (project.isClosing()) {
                // Project is being closed
                const projectID = fwProject.projectID;
                const data = {
                  changeType: "delete", 
                  projectID: projectID
                }
                WebSocket.watchListChanged(data);
                await this.handleProjectClosed(fwProject, project);
              } else if (project.isDeleting() ) {
                // Project is being deleted
                const projectID = fwProject.projectID;
                const data = {
                  changeType: "delete", 
                  projectID: projectID
                }
                WebSocket.watchListChanged(data);
                await this.handleProjectDeleted(fwProject, project);
              } else {
                log.error(`Unexpected project deletion event for: ${fwProject.projectID}:`);
                log.error(fwProject);
              }
            } catch (err) {
                let data = {
                  projectID: fwProject.projectID,
                  status: 'failure',
                  error: err.message
                }
                this.user.uiSocket.emit('projectDeletion', data);
                log.error(`Error deleting project ${fwProject.projectID}`);
                log.error(err);
              }
              break;
        }
        
        case "projectChanged" : {
          await this.handleFWProjectEvent('projectChanged', fwProject);
          break;
        }

        case "projectValidated" : {
          logEvent('projectValidated', fwProject);
          delete fwProject.operationId;
          fwProject.validationStatus = fwProject.status;
          delete fwProject.status;
          fwProject.validationResults = fwProject.results;
          delete fwProject.results;
          delete fwProject.error;

          try {
            await this.user.projectList.updateProject(fwProject);
            this.user.uiSocket.emit('projectValidated', fwProject);
          } catch (err) {
            log.error(err);
          }
          break;
        }

        case "projectStatusChanged" : {
          await this.handleFWProjectEvent('projectStatusChanged', fwProject);
          break;
        }

        case "projectRestartResult" : {
          await this.handleFWProjectEvent('projectRestartResult', fwProject);
          break;
        }

        case "projectLogsListChanged" : {
          let logType;
          if (fwProject.build) {
            logType = 'build'
          } else if (fwProject.app) {
            logType = 'app'
          } else {
            log.error('projectLogsListChanged: Unknown log type.');
            break;
          }
          let file = fwProject[logType].files[0];
          let logName = path.basename(file);
          let logObject = { logName: logName }
          if (fwProject[logType].origin == 'workspace') {
            logObject.workspaceLogPath = path.dirname(file);
          }
          let message = { projectID: fwProject.projectID };
          message[logType] = [logObject];
          this.user.uiSocket.emit('projectLogsListChanged', message);
          break;
        }

        case "newProjectAdded": {
          await this.handleFWProjectEvent('newProjectAdded', fwProject);
        }

        default: {
          log.debug("Unknown event received: " + event);
          log.debug("Detailed message received from file-watcher module: " + JSON.stringify(fwProject));
        }
        }
      }
    });
  }


  async validateProject(project){
    const projectAction = {
      action: 'validate',
      projectID: project.projectID,
      projectType: project.projectType,
      location: project.projectPath(false)
    };
    await this.performProjectActionRequest(projectAction);
  }

  async buildProject(project, buildAction){
    const projectAction = {
      action: buildAction,
      projectID: project.projectID,
      projectType: project.projectType
    };
    const responseBody = await this.performProjectActionRequest(projectAction);
    return responseBody;
  }

  async restartProject(project, startMode){
    const projectAction = {
      action: 'restart',
      projectID: project.projectID,
      startMode: startMode,
      applicationPort: project.applicationPort
    };
    await this.performProjectActionRequest(projectAction);
  }

  async logFWReturnedMsg(msg) {
    log.debug("Received filewatcher module response: ")
    log.debug(JSON.stringify(msg));
  }


  async buildAndRunProject(project){
    let settingsFileContents = await project.readSettingsFile();
    let projectAction = {
      projectID: project.projectID,
      projectType: project.projectType,
      contextroot: project.contextRoot,
      startMode: project.startMode,
      location: project.projectPath(false),
      applicationPort: project.applicationPort,
      settings: settingsFileContents
    };

    // TODO: EXTENSIONS
    // if (isExtension(project.projectType)) {
    //   projectAction.extension = {
    //     extensionID: getExtensionID(project.projectType)
    //   };
    // }

    log.info(`Calling createProject() for project ${project.name} ${JSON.stringify(projectAction)}`);
    let retval;
    try {
      retval = await filewatcher.createProject(projectAction);
    } catch(err) {
      throw new FilewatcherError('UNKNOWN_ERROR', err, 500);
    }
    this.logFWReturnedMsg(retval);
    switch (retval.statusCode) {
    case 202:
      log.debug(`Build request for project '${project.projectID}' accepted successfully`)
      return retval;
    case 400:
      throw new FilewatcherError('REQUEST_VALIDATION_ERROR', project.projectID, extractMessageFromListenerResponse(retval));
    case 404:
      throw new ProjectListError('NOT_FOUND', project.projectID);
    case 500:
      throw new FilewatcherError('INTERNAL_ERROR', `${project.name} (${project.projectID})`, extractMessageFromListenerResponse(retval));
    default:
      throw new FilewatcherError('INTERNAL_ERROR', `${project.name} (${project.projectID})`, `Unknown response code: ${retval.statusCode}. ${extractMessageFromListenerResponse(retval)}`);
    }
  }

  async projectCapabilities(project) {
    const retval = await filewatcher.getProjectCapabilities(project.projectID);
    this.logFWReturnedMsg(retval);
    switch (retval.statusCode) {
    case 200:
      // Obtained the list of project types
      if (retval && retval.capabilities) {
        return retval.capabilities;
      }
      throw new FilewatcherError('NO_PROJECT_CAPABILITIES', retval.statusCode);
    case 404:
      throw new FilewatcherError('PROJECT_NOT_FOUND', project.projectID, `Filewatcher status code ${retval.statusCode}`);
    case 500:
      throw new FilewatcherError('FILE_WATCHER_INTERNAL_FAILURE', retval.statusCode);
    default:
      throw new FilewatcherError('UNKNOWN_STATUS_CODE', retval.statusCode);
    }
  }

  async deleteProject(project){
    const retval = await filewatcher.deleteProject(project.projectID);
    this.logFWReturnedMsg(retval);
    switch (retval.statusCode) {
    case 202:
      log.debug(`Deletion request for project ${project.projectID} accepted by file-watcher`);
      break;
    case 404:
      throw new FilewatcherError('PROJECT_NOT_FOUND', project.projectID, `Filewatcher status code ${retval.statusCode}`);
    case 500:
      throw new FilewatcherError('FILE_WATCHER_INTERNAL_FAILURE', retval.statusCode);
    default:
      throw new FilewatcherError('UNKNOWN_ERROR', retval.statusCode);
    }
  }

  async closeProject(project){
    const retval = await filewatcher.deleteProject(project.projectID);
    this.logFWReturnedMsg(retval);
    switch (retval.statusCode) {
    case 202:
      log.debug(`Request to close project ${project.projectID} accepted by file-watcher`);
      break;
    case 404:
      throw new FilewatcherError;
    case 500:
      throw new FilewatcherError('FILE_WATCHER_INTERNAL_FAILURE', retval.statusCode);
    default:
      throw new FilewatcherError('UNKNOWN_ERROR', retval.statusCode);
    }
  }

  async projectTypes() {
    const retval = await filewatcher.getProjectTypes(null);
    this.logFWReturnedMsg(retval);
    switch (retval.statusCode) {
    case 200:
      if (retval && retval.types) {
        return appendExtensionProjectTypes(retval.types);
      }
      throw new FilewatcherError('NO_PROJECT_TYPE_LIST', retval.statusCode);
    case 500:
      throw new FilewatcherError('FILE_WATCHER_INTERNAL_FAILURE', retval.statusCode);
    default:
      throw new FilewatcherError('UNKNOWN_ERROR', retval.statusCode);
    }
  }

  async identifyProjectType(project) {
    const location = project.projectPath(false);
    const retval = await filewatcher.getProjectTypes(location);
    this.logFWReturnedMsg(retval);
    switch (retval.statusCode) {
    case 200:
      if (retval && retval.types) {
        return appendExtensionProjectTypes(retval.types);
      }
      throw new FilewatcherError('NO_PROJECT_TYPE_LIST', retval.statusCode);
    case 404:
      throw new FilewatcherError('NO_PROJECT_LOCATION', 'identifyProjectType: Project location does not exist', retval.statusCode);
    case 500:
      throw new FilewatcherError('FILE_WATCHER_INTERNAL_FAILURE', retval.statusCode);
    default:
      throw new FilewatcherError('UNKNOWN_ERROR', retval.statusCode);
    }
  }

  async getProjectLogs(project) {
    let logsResult;
    try {
      logsResult = await filewatcher.getProjectLogs(project.projectID);
    } catch(err) {
      throw new FilewatcherError('UNKNOWN_ERROR', err, 500);
    }
    this.logFWReturnedMsg(logsResult);
    switch (logsResult.statusCode) {
    case 200:
      if (logsResult.logs) {
        return logsResult.logs;
      }
      throw new FilewatcherError('NO_PROJECT_LOG_LIST', logsResult.statusCode);
    case 400:
      throw new FilewatcherError('REQUEST_VALIDATION_ERROR', project.projectID, extractMessageFromListenerResponse(logsResult));
    case 404:
      throw new FilewatcherError('PROJECT_NOT_FOUND', project.projectID, `Filewatcher status code ${logsResult.statusCode}`);
    case 500:
      throw new FilewatcherError('FILE_WATCHER_INTERNAL_FAILURE', logsResult.statusCode);
    default:
      throw new FilewatcherError('UNKNOWN_ERROR', logsResult.statusCode);
    }
  }

  async checkNewLogFile(projectID, type) {
    log.info(`Check for new ${type} log files for project ${projectID}`);
    try {
      const retval = await filewatcher.checkNewLogFile(projectID, type);
      this.logFWReturnedMsg(retval);
      if (retval.statusCode != 200) {
        throw new Error(`check project logs ${retval.statusCode} ${retval.error.msg}`);
      }
    } catch (err) {
      log.error(err);
    }
  }

  async performProjectActionRequest(projectAction){
    const retval = await filewatcher.performProjectAction(projectAction);
    this.logFWReturnedMsg(retval);
    handleProjectActionResponse(retval, projectAction.projectID);
    return retval;
  }

  async projectSettingsChanged(fwProject) {
    logEvent('projectSettingsFileChanged', fwProject);
    const newProjectProperties = await this.user.projectList.reloadSettingsFile(fwProject);
    const settingsFileContents = await newProjectProperties.readSettingsFile();
    let body = { 'projectID': fwProject.projectID, 'settings': settingsFileContents};
    try{
      const retval = await filewatcher.reconfigProjectSpecification(body);
      this.logFWReturnedMsg(retval);
      if (retval.statusCode != 202){
        throw new Error(`project settings ${retval.statusCode} ${retval.err.msg}`);
      }
    } catch (err) {
      log.error(err);
    }

  }

  async updateProject(fwProject) {
    try{
      const retval = await filewatcher.updateProject(fwProject.projectID);
      this.logFWReturnedMsg(retval);
      if (retval.statusCode != 202){
        throw new Error(`project update ${retval.statusCode} ${retval.err.msg}`);
      }
    } catch (err) {
      log.error(err);
    }
  }

  async updateStatus(body) {
    try{
      const retval = await filewatcher.updateStatus(body);
      this.logFWReturnedMsg(retval);
      if (retval.statusCode != 200){
        throw new Error(`project update ${retval.statusCode} ${retval.err.msg}`);
      }
    } catch (err) {
      log.error(err);
    }
  }

  async deploymentRegistryStatus(body) {
    let retval;
    try {
      retval = await filewatcher.deploymentRegistryStatus(body);
      this.logFWReturnedMsg(retval);
    } catch (err) {
      log.error(err);
    }
    if (retval.statusCode != 200) {
      throw new Error(`deploymentRegistryStatus ${retval.statusCode} ${retval.error.msg}`);
    }
  }

  async projectFileChanged(projectID, timestamp, chunk, chunk_total, eventArray) {
    try {
      const retval = await filewatcher.updateProjectForNewChange(projectID, timestamp, chunk, chunk_total, eventArray);
      this.logFWReturnedMsg(retval);
      if (retval.statusCode != 202){
          throw new Error(`project update ${retval.statusCode} ${retval.err.msg}`);
      }
    } catch (err) {
      log.error(err);
    }
  }


  /**
   * Response function to fw create / changed socket events
   * Updates the changed project in the projectList
   * Sends the updatedProject to the UI
   */
  async handleFWProjectEvent(event, fwProject) {
    logEvent(event, fwProject);

    try {
      // Strip out the fields we don't want to save in the project.inf.
      let { operationId, error, status, name, ...projectUpdate } = fwProject;
      let results = {};
      // Errors and failures will have been logged by logEvent above.
      if(status) {
        results.status = status;
      }
      if(error) {
        results.error = error;
      }
      let updatedProject = await this.user.projectList.updateProject(projectUpdate);
      this.user.uiSocket.emit(event, {...results , ...updatedProject});
      if (fwProject.buildStatus === 'inProgress') {
        // Reset build logs.
        updatedProject.resetLogStream('build');
      }
      if (event == 'projectCreation') {
        // Reset app logs. Don't check if the app came up successfully,
        // we will want to see logs for failing apps.
        updatedProject.resetLogStream('app');
      }
      if (event == 'newProjectAdded' || event == 'projectSettingsChanged') {
        let changeType;
        if (event == "newProjectAdded") {
          changeType = "add";
        }
        if (event == 'projectSettingsChanged') {
          changeType = "update";
        }
        const projectID = fwProject.projectID;
        const ignoredPaths = fwProject.ignoredPaths;
        const project = this.user.projectList.retrieveProject(projectID);
        const pathToMonitor = path.join(project.workspace, project.directory);
        const projectWatchStateId = crypto.randomBytes(16).toString("hex");
        const data = {
          changeType: changeType, 
          projectWatchStateId: projectWatchStateId,
          projectID: projectID,
          pathToMonitor: pathToMonitor,
          ignoredPaths: ignoredPaths,
        }
        let projectUpdate = { projectID: projectID, projectWatchStateId: projectWatchStateId };
        await this.user.projectList.updateProject(projectUpdate);
        WebSocket.watchListChanged(data);
      }
    } catch (err) {
      log.error(err);
    }
  }

  async handleProjectClosed(fwProject, project) {
    // Set project state to closed if the operation succeeded.
    let updatedProject = project;
    if (fwProject.status === 'success') {
      let projectUpdate = {
        projectID: fwProject.projectID,
        ports: '',
        buildStatus: 'unknown',
        appStatus: 'unknown',
        state: Project.STATES.closed
      }
      // Set the container key to '' as the container has stopped.
      const containerKey = (global.microclimate.RUNNING_IN_K8S ? 'podName' : 'containerId');
      projectUpdate[containerKey] = '';
      updatedProject = await this.user.projectList.updateProject(projectUpdate);
      await this.user.projectList.deleteProjectKey(fwProject.projectID, 'action');
    }
    // We have to emit the full project state *and* the operation status.
    // (Storing the status in the project object is bad as it is
    // only about this close operation.)
    this.user.uiSocket.emit('projectClosed', {...updatedProject, status: fwProject.status});
    log.debug('project ' + fwProject.projectID + ' successfully closed');
  }

  // Send the project deleted event. We do not need to send updates
  // to the project object as the project no longer exists.
  async handleProjectDeleted(fwProject, project) {
    // Project is being deleted
    if (fwProject.status === 'success') {
      // Remove files from disk
      await this.user.deleteProjectFiles(project);
    }
    this.user.uiSocket.emit('projectDeletion', {
      projectID: fwProject.projectID,
      status: fwProject.status
    });
  }

  async setLocale(locale) {
    this.locale = locale;
    const retval = await filewatcher.setLocale(locale);
    this.logFWReturnedMsg(retval);
    if (retval.statusCode != 200) {
      log.error(retval.error.msg);
    }
  }

  async testDeploymentRegistry(deploymentRegistry) {
    let retval;    
    try{
      retval = await filewatcher.testDeploymentRegistry(deploymentRegistry);
      this.logFWReturnedMsg(retval);
    } catch (err) {
      log.error(err);
    }
    if (retval.statusCode != 200) {
      throw new Error(`testDeploymentRegistry ${retval.statusCode} ${retval.error.msg}`);
    }
  }

  async readWorkspaceSettings() {
    let retval;
    try{
      retval = await filewatcher.readWorkspaceSettings();
      this.logFWReturnedMsg(retval);
    } catch (err) {
      log.error(err);
    }
    if (retval.statusCode != 200) {
      throw new Error(`readWorkspaceSettings ${retval.statusCode} ${retval.error.msg}`);
    }
  }

  /**
   * Function to shutdown the user's projects
   */
  async shutdown() {
    // Call file-watcher shutdown so they can close stop/remove any deployments related to the user's projects.
    if(this.up) {
      let fwRes = await filewatcher.shutdown();
      switch (fwRes.statusCode) {
      case 202:
        break;
      case 500:
        log.error(`shutdown: error sending shutdown request (500 received)`);
        break;
      default:
        log.error(`shutdown: (${fwRes.statusCode} received)`);
      }
    } else {
      // The file watcher isn't running/reachable, just remove disconnect the socket
      this.up = false;
    }
  }

}

function handleProjectActionResponse(res, projectID) {
  switch (res.statusCode){
  case 200:
    log.debug(`Action successfully completed`);
    break;
  case 202:
    log.debug(`Request for action accepted`);
    break;
  case 400: throw new FilewatcherError('REQUEST_VALIDATION_ERROR', projectID, extractMessageFromListenerResponse(res));
  case 404: throw new ProjectListError('NOT_FOUND', projectID);
  case 500: throw new FilewatcherError('INTERNAL_ERROR', projectID, extractMessageFromListenerResponse(res));
  default: throw new FilewatcherError('INTERNAL_ERROR', projectID, extractMessageFromListenerResponse(res));
  }
}

function extractMessageFromListenerResponse(res) {
  return res.error.msg || '';
}

function logEvent(event, projectData) {
  const possibleStatusKeys = ['status', 'buildStatus', 'appStatus'];
  let status = 'unknown';
  for (const key of possibleStatusKeys) {
    if (Object.keys(projectData).includes(key)) status = projectData[key];
  }
  const msg = `${event}: ${status} (project`;
  if(status == 'failed' || projectData.error) {
    log.error(`${msg}: ${JSON.stringify(projectData, null, 2)})`);
  }
  log.debug(`${msg} ${projectData.projectID})`);
  log.trace(`${msg}: ${JSON.stringify(projectData, null, 2)})`);
}

function appendExtensionProjectTypes(types) {
  // TODO: EXTENSIONS
  return types;
}
