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

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const ProjectList = require('./ProjectList');
const FileWatcher = require('./FileWatcher');
const LoadRunner = require('./LoadRunner');
const Project = require('./Project');
const ExtensionList = require('./ExtensionList');
const Templates = require('./Templates');
const cwUtils = require('./utils/sharedFunctions');
const Logger = require('./utils/Logger');
const LoadRunError = require('./utils/errors/LoadRunError.js');
const FilewatcherError = require('./utils/errors/FilewatcherError');
const log = new Logger('User.js');
const util = require('util');

/**
 * The User class
 * @param {Object} args, contains:
 *    - workspace, the users workspace
 *    - uiSocket, the socket we use to communicate with the UI
 */
module.exports = class User {

  static async createUser(user_id, userString, workspace, uiSocket) {
    let user = new User(user_id, userString, workspace, uiSocket);
    await user.initialise();
    return user;
  }

  constructor(user_id, userString, workspace, uiSocket ) {
    this.user_id = user_id || "default";
    this.userString = userString || null;
    this.workspace = workspace;
    // socket.io namespace is user or false (single user, no need for a namespace)
    this.uiSocketNamespace = (this.user_id) ? path.normalize(`/${this.user_id}`) : false;
    // Setup socket to the UI for this user
    if (this.uiSocketNamespace) {
      this.uiSocket = uiSocket.of(this.uiSocketNamespace);
    } else {
      this.uiSocket = uiSocket;
    }
    this.secure = true;
  }
  
  /**
   * Function to initialise a user
   * Runs functions to create the user directories, start existing projects
   */
  async initialise() {
    try {
      // Add trailing slash to end of the workspace directory, stops generator errors
      if (this.workspace.substr(-1) != '/') this.workspace += '/';
      this.directories = {
        workspace: this.workspace,
        projects: path.join(this.workspace, '/.projects/'),
        logs: path.join(this.workspace, '/.logs/'),
        config: path.join(this.workspace, '/.config/'),
        extensions: path.join(this.workspace, '/.extensions/'),
      }
      await this.createDirectories();
      this.projectList = new ProjectList();
      
      // Add the projectList to args
      await this.initialiseExistingProjects();

      this.templates = new Templates(this.workspace);
      await this.templates.initializeRepositoryList();

      // Create the list of codewind extensions
      this.extensionList = new ExtensionList();

      // Attempt to install built-in extension packages
      try {
        await this.extensionList.installBuiltInExtensions(this.directories.extensions);
      } catch (error) {
        log.error(`Failed to install built-in Codewind extensions. Error ${util.inspect(error)}`);
      }

      try {
        await this.extensionList.initialise(this.directories.extensions, this.templates);
      } catch (error) {
        log.error(`Codewind extensions failed to load. Error ${util.inspect(error)}`);
      }

      // Create the FileWatcher and LoadRunner classes for this user
      this.fw = new FileWatcher(this);
      this.loadRunner = new LoadRunner(this);
      this.fw.setLocale(["en"]);
      this.startExistingProjects();
    } catch (err) {
      log.error(`Error initialising User`);
      log.error(err);
    }
  }

  /**
   * Function to run load on project
   */
  async runLoad(project, description) {
    log.debug("runLoad: project " + project.projectID + " loadInProgress=" + project.loadInProgress);
    // If load in progress, throw an error
    if (project.loadInProgress) {
      throw new LoadRunError("RUN_IN_PROGRESS", `For project ${project.projectID}`);
    }
    project.loadInProgress = true;
    try {
      let config = await project.getLoadTestConfig();
      let url = "http://" + project.host + ":" + project.getPort() + config.path;
      config.url = url;
      project.loadConfig = config;
      log.debug(`Running load for project: ${project.projectID} config: ${JSON.stringify(config)}`);
      const runLoadResp = await this.loadRunner.runLoad(config, project, description);
      return runLoadResp;
    } catch(err) {
      // Reset run load flag and config in the project, and re-throw the error
      project.loadInProgress = false;
      project.loadConfig = null;
      throw err;
    }
  }

  /**
   * Function to cancel load on project
   */
  async cancelLoad(project){
    log.debug("cancelLoad: project " + project.projectID + " loadInProgress=" + project.loadInProgress);

    if (project.loadInProgress) {
      project.loadInProgress = false;
      log.debug("Cancelling load for config: " + JSON.stringify(project.loadConfig));
      this.uiSocket.emit('runloadStatusChanged', { projectID: project.projectID,  status: 'cancelling' });
      let cancelLoadResp = await this.loadRunner.cancelRunLoad(project.loadConfig);
      this.uiSocket.emit('runloadStatusChanged', { projectID: project.projectID,  status: 'cancelled' });
      return cancelLoadResp;
    }
    throw new LoadRunError("NO_RUN_IN_PROGRESS", `For project ${project.projectID}`);
  }

  /**
   * Function to create the user directories
   * Will only create the directory if it doesn't exist
   */
  async createDirectories() {
    for (let key in this.directories) {
      let dir = this.directories[key];
      await fs.ensureDir(dir);
    }
  }

  /**
   * Function to initialise a users existing projects
   * Searches the directory containing the project inf files so we only
   * add projects we've run previously to the projectList
   * @return the projectList with all the existing projects in
   */
  async initialiseExistingProjects() {
    let fileNameList = await fs.readdir(this.directories.projects);
    await Promise.all(fileNameList.map(async (fileName) => {
      let file = path.join(this.directories.projects, fileName);
      if (!fileName.startsWith('.')) {
        try {
          const projFile = await fs.readJson(file);
          // should now have a project name
          const projName = projFile.name;
          let settingsFilePath = path.join(projFile.workspace, projName, '.cw-settings');
          const settFileExists = await fs.pathExists(settingsFilePath);
          const settFile = settFileExists ? await fs.readJson(settingsFilePath) : {};
          let project = new Project({ ...projFile, ...settFile }, projFile.workspace);
          this.projectList.addProject(project);
        } catch (err) {
          // Corrupt project inf file
          if (err instanceof SyntaxError) {
            log.error('Failed to parse project file ' + fileName);
          } else {
            log.error(err);
          }
        }
      }
    } ))
    return this.projectList.list;
  }

  /**
   * Function to get watchList for all open projects
   */
  async getWatchList() {
    let fileNameList = await fs.readdir(this.directories.projects);
    let watchList = {
      projects:[]
    };
    await Promise.all(fileNameList.map(async (fileName) => {
      let file = path.join(this.directories.projects, fileName);
      if (!fileName.startsWith('.')) {
        try {
          const projFile = await fs.readJson(file);
          // do not add closed project in the list
          if(projFile.state == Project.STATES.closed){
            return;
          }
          const project = {};
          const projName = projFile.name;
          project.pathToMonitor = projFile.locOnDisk;
          //project.pathToMonitor = path.join(projFile.workspace, projFile.directory);
          if (process.env.HOST_OS === "windows") {
            project.pathToMonitor = cwUtils.convertFromWindowsDriveLetter(project.pathToMonitor);
          }
          project.projectID = projFile.projectID;
          project.ignoredPaths = projFile.ignoredPaths;
          if( projFile.projectWatchStateId == undefined) {
            project.projectWatchStateId = crypto.randomBytes(16).toString("hex");
            let projectUpdate = { projectID: projFile.projectID, projectWatchStateId: project.projectWatchStateId };
            await this.projectList.updateProject(projectUpdate);
          } else {
            project.projectWatchStateId = projFile.projectWatchStateId;
          }
          log.debug("Find project " + projName + " with info: " + JSON.stringify(project));
          watchList.projects.push(project);
        } catch (err) {
          // Corrupt project inf file
          if (err instanceof SyntaxError) {
            log.error('Failed to parse project file ' + fileName);
          } else {
            log.error(err);
          }
        }
      }
    } ));
    
    log.debug("The watch list: " + JSON.stringify(watchList));
    return watchList;
  }


  /**
 * Function to notify file-watcher start building, stop building, or perform a
 * one of build of a project.
 * @param projectID, an identifier for a project
 * @param timestamp, the timestamp for the file change list
 * @param chunk, the current chunk number
 * @param chunkTotal, the total chunks expected for this timestamp
 * @param eventArray, the file change event array
 */
  async fileChanged(projectID, timestamp, chunkNum, chunkTotal, eventArray) {
    try {
      log.debug(`Project ${projectID} file change list received on ${timestamp}. chunk number ${chunkNum} with total chunk ${chunkTotal} for this timestamp.`);
      await this.fw.projectFileChanged(projectID, timestamp, chunkNum, chunkTotal, eventArray);
    } catch (err) {
      log.error('Error in function fileChanged');
      log.error(err);
    }
  }

  /**
   * Function to start the users existing projects
   * This is separate from initialiseExistingProjects as we want it to
   * execute at the end of the user initialisation
   * Will only start a project if it is marked as open
   */
  startExistingProjects() {
    // Don't try to start the projects until the file-watcher
    // is available.
    if (this.fw.up) {
      // Only request the building of projects that are open
      let projectArray = this.projectList.getAsArray();
      for (let i = 0; i < projectArray.length; i++) {
        let project = projectArray[i];
        // Don't request build if project is closed
        if (project.isOpen()) {
          this.buildAndRunProject(project);
        }
      }
    }
  }

  /**
   * Function to create and add project to the projectList
   * as well as saving it's .inf file so it is present when
   * codewind restarts.
   * Throws an error if the project already exists
   * @param projectJson, the project to add to the projectList
   */
  async createProject(projectJson) {
    let project = new Project(projectJson, projectJson.workspace);
    this.projectList.addProject(project);
    // If checkIfMetricsAvailable errors, it should not break project creation
    // try {
    //   await project.checkIfMetricsAvailable();
    // } catch (err) {
    //   log.error(err);
    // }
    await project.writeInformationFile();
    return project;
  }

  /**
   * Function to notify file-watcher that it needs to validate a given project
   * @param project, an instance of the Project class
   */
  validateProject(project) {
    try {
      log.debug('Project ' + project.projectID + ' being validated');
      this.fw.validateProject(project);
    } catch (err) {
      log.error('Error in function validateProject');
      log.error(err);
      // Notify the client via socket event that validation has failed
      let data = {
        projectID: project.projectID,
        validationStatus: 'failed'
      };
      this.uiSocket.emit('projectValidated', data);
    }
  }

  /**
   * Function to notify file-watcher start building, stop building, or perform a
   * one of build of a project.
   * @param project, an instance of the Project class
   * @param action, the build action enableautobuild, disableautobuild or build.
   */
  async buildProject(project, action) {
    let data;
    try {
      log.debug(`Project ${project.projectID} build action ${action}`);
      data = await this.fw.buildProject(project, action);
      if (data && data.status === 'success') {
        if (action === 'disableautobuild') {
          await this.projectList.updateProject({
            projectID: project.projectID,
            autoBuild: false
          });
        } else if (action === 'enableautobuild') {
          await this.projectList.updateProject({
            projectID: project.projectID,
            autoBuild: true
          });
        }
      }
    } catch (err) {
      log.error('Error in function buildProject');
      log.error(err);
    }
  }

  /**
   * Function to notify file-watcher restart a project
   * @param project, an instance of the Project class
   * @return Promise which resolves to Response object from FileWatcher
   */
  async restartProject(project, startMode) {
    log.debug(`Restarting project ${project} (startMode: ${startMode})`);
    await this.fw.restartProject(project, startMode);
    await this.projectList.updateProject({ projectID: project.projectID, startMode });
  }

  /**
   * Function to notify file-watcher that it needs to build and run a given project
   * @param project, an instance of the Project class
   */
  async buildAndRunProject(project) {
    try {
      log.info(`Building project ${project.projectID} (${project.name})`);
      const buildInfo = await this.fw.buildAndRunProject(project);
      if (buildInfo.logs && buildInfo.logs.build && buildInfo.logs.build.file) {
        project.buildLogPath = buildInfo.logs.build.file;
      } else {
        log.debug(`No build log for ${project.projectID} (${project.name})`);
      }
    } catch(err) {
      log.error(`Project build failed for ${project.projectID} (${project.name})`);
      log.error(err);
      let updatedProject = {
        projectID: project.projectID,
        state: Project.STATES.closed,
        autoBuild: false
      }
      await this.projectList.updateProject(updatedProject);
      this.uiSocket.emit('projectClosed', updatedProject);
    }
  }

  async updateStatus(body) {
    log.info(`Updating status for project ${body.projectID}.`);
    await this.fw.updateStatus(body);
  }

  async deploymentRegistryStatus(body) {
    log.info(`Updating deployment registry status for project ${body.projectID}.`);
    try{
      await this.fw.deploymentRegistryStatus(body);
    } catch (err) {
      log.error(`Error in deploymentRegistryStatus`);
      log.error(err);
    }
  }

  async checkNewLogFile(projectID, type) {
    log.info(`Check for new log files for project ${projectID}`);
    await this.fw.checkNewLogFile(projectID, type);
  }

  /**
   * Function to obtain an object containing the object capabilities
   * from the file-watcher.
   * @return JSON object with the capabilities of the project listed
   */
  async projectCapabilities(project) {
    const capabilities  = await this.fw.projectCapabilities(project);
    return capabilities;
  }

  /**
   * Function to unbind a project
   * Asks file-watcher to stop a project,
   * if we get a 200, removes the project.inf
   * @param project, the project to unbind
   */

  async unbindProject(project) {
    const projectID = project.projectID;
    const successMsg = {
      projectID: projectID,
      status: 'success'
    };
    // Stop streaming the logs files.
    project.stopStreamingAllLogs();
    // If the project is closed or validating or of unknown language
    // don't check with filewatcher, just delete it
    if (project.isClosed() || project.isValidating()) {
      await this.deleteProjectFiles(project);
      this.uiSocket.emit('projectDeletion', successMsg);
      return;
    }

    try {
      log.debug(`Deleting project ${project} from file watcher.`);
      await this.fw.deleteProject(project);
    } catch (err) {
      // If FW is not up or doesn't know about the project, we can just delete files and emit event
      if (err instanceof FilewatcherError && (err.code == 'CONNECTION_FAILED' || err.code == 'PROJECT_NOT_FOUND')) {
        await this.deleteProjectFiles(project);
        this.uiSocket.emit('projectDeletion', successMsg);
      } else throw err; // If it's not an error we anticipate, pass it on
    }
  }

  /**
   * Function to close a project
   * Asks file-watcher to delete the project,
   * @param project, the project to close
   */
  async closeProject(project) {
    let projectPath = path.join(this.directories.workspace, project.directory);
    let projectID = project.projectID;
    // Stop streaming the logs files.
    project.stopStreamingAllLogs();
    
    if (await fs.pathExists(projectPath)) {
      try {
        await this.fw.closeProject(project);
      } catch (err) {
        // IF FW not up we can simply update the state and emit event
        if (err instanceof FilewatcherError && err.code == 'CONNECTION_FAILED') {
          let projectUpdate = {
            projectID: projectID,
            ports: '',
            buildStatus: 'unknown',
            appStatus: 'unknown',
            state: Project.STATES.closed
          }
          // Set the container key to '' as the container has stopped.
          const containerKey = (global.codewind.RUNNING_IN_K8S ? 'podName' : 'containerId');
          projectUpdate[containerKey] = '';
          let updatedProject = await this.user.projectList.updateProject(projectUpdate);
          this.user.uiSocket.emit('projectClosed', {...updatedProject, status: 'success'});
          log.debug('project ' + projectID + ' successfully closed');
        } else throw err;
      }
    }
  }

  async deleteProjectFiles(project) {
    // Remove from our list
    await this.projectList.removeProject(project.projectID);

    try {
      // Remove project meta inf
      await fs.unlink(`${this.directories.workspace}.projects/${project.projectID}.inf`);
      log.info(`Removing project directory at ${project.location}`);
      await cwUtils.forceRemove(project.location);
    } catch (err) {
      // Make sure both these operations complete, we will throw an error later on if
      // the files failed to delete.
      log.error('Error removing project files:');
      log.error(err);
    }

    // Remove project log file
    try {
      let buildLog = project.getBuildLogPath();
      if (buildLog) {
        await fs.unlink(buildLog);
      }
    } catch (err) {
      // Log file could be missing if the project never built.
    }
  }


  /**
   * Function to obtain the list of supported project types. We get the built-in set
   * from the file-watcher then add extension project types if any
   * @return the list of project types or undefined.
   */
  async projectTypes() {
    let projectTypes = await this.fw.projectTypes();
    return projectTypes.concat(this.extensionList.getProjectTypes());
  }

  /**
   * Function to obtain the logs for a given project
   * from the file-watcher.
   * @return the list of logs for a project
   */
  async getProjectLogs(project) {
    const logs = await this.fw.getProjectLogs(project);
    await this.projectList.updateProject({
      projectID: project.projectID,
      logs: logs
    });
    return logs;
  }

  /**
   * Function to check if the file watcher is up
   * Uses a promise to pause the function and then recursion to check again
   * @return status on whether fw is up
   */
  async checkIfFileWatcherUp(tries) {
    if (this.fw.up) {
      return true;
    } else if (tries === 0) {
      return false;
    }
    await cwUtils.timeout(500);
    return this.checkIfFileWatcherUp(tries - 1);
  }

  /**
   * Function to get status of deployment registry in workspace settings file
   */
  async getDeploymentRegistryStatus() {
    // workspaceSettingsFile is the path inside PFE Container
    const workspaceSettingsFile = path.join(this.directories["config"], "settings.json");
    let contents;
    let isDeploymentRegistrySet = false;
    log.info(`Checking PFE & workspace settings deployment registry`);

    try {
      if (await fs.pathExists(workspaceSettingsFile)) {
        contents = await fs.readJson(workspaceSettingsFile);
        log.debug(`Workspace settings contents: ` + JSON.stringify(contents));
      } else {
        log.debug("Settings file " + workspaceSettingsFile + " does not exist");
        // Due to network PV issues, sometimes the file does not get detected in the Codewind container
        // Reading the dir forces the settings file to be available to the Codewind container
        let files = await fs.readdir(this.directories["config"]);
        log.debug(this.directories["config"] + " file listing: ");
        files.forEach(function (file) {
          log.debug(file);
        });
      }
    } catch (err) {
      log.error("Error reading file " + workspaceSettingsFile);
      log.error(err);
      const workspaceSettings = {
        statusCode: 500,
        deploymentRegistry: false
      }
      return workspaceSettings;
    }

    if (contents && contents.deploymentRegistry && contents.deploymentRegistry.length > 0) {
      log.debug(`Workspace settings deploymentRegistry` + contents.deploymentRegistry);
      isDeploymentRegistrySet = true;

      // trigger the FW workspaceSettings.readWorkspaceSettings() function to load up the cache since it's valid
      log.info(`Workspace settings file present, reading the settings file`);
      await this.readWorkspaceSettings();
    }
    log.info(`Workspace settings deployment registry status: ${isDeploymentRegistrySet}`);

    const workspaceSettings = {
      statusCode: 200,
      deploymentRegistry: isDeploymentRegistrySet
    }

    return workspaceSettings;
  }
  /**
   * Function to read workspace settings
   */
  async readWorkspaceSettings() {
    try{
      log.info(`Reading workspace settings file.`);
      await this.fw.readWorkspaceSettings();
    } catch (err) {
      log.error(`Error in readWorkspaceSettings`);
      log.error(err);
    }
  }

  /**
   * Function to write workspace settings
   */
  async writeWorkspaceSettings(workspaceSettings) {
    let retval;
    try{
      log.info(`Writing workspace settings file.`);
      retval = await this.fw.writeWorkspaceSettings(workspaceSettings);
    } catch (err) {
      log.error(`Error in writeWorkspaceSettings`);
      log.error(err);
    }
    log.debug(`writeWorkspaceSettings return value: ` + JSON.stringify(retval));
    return retval;
  }

  /**
   * Function to get test deployment registry
   */
  async testDeploymentRegistry(deploymentRegistry) {
    let retval;
    try{
      retval = await this.fw.testDeploymentRegistry(deploymentRegistry);
    } catch (err) {
      log.error(`Error in testDeploymentRegistry`);
      log.error(err);
    }
    return retval;
  }

  /**
   * Function to set locale
   */
  setLocale(locale) {
    this.fw.setLocale(locale);
  }

  /**
   * Function to set log level
   */
  async setLoggingLevel(level) {
    try {
      await this.fw.setLoggingLevel(level);
    } catch (err){
      log.error(`Error setting log level on filewatcher module`);
      log.error(err);
    }
  }
}
