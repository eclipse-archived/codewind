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
const socketAuthFunctions = require('./utils/socketAuth');
const Logger = require('./utils/Logger');
const LoadRunError = require('./utils/errors/LoadRunError.js');
const RegistrySecretsError = require('./utils/errors/RegistrySecretsError.js');
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

  constructor(user_id, userString, workspace, uiSocket) {
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
    this.dockerConfigFile = "/root/.docker/config.json";
    this.codewindPFESecretName = "codewind-" + process.env.CHE_WORKSPACE_ID + "-docker-registries";
    // Get the Kube Client context when running in K8s
    if (global.codewind.RUNNING_IN_K8S == true) {
      this.k8Client = global.codewind.k8Client;
    }
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
        temp: path.join(this.workspace, global.codewind.CODEWIND_TEMP_WORKSPACE),
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

      // Connect up the UI Socket Authentication handler
      if (process.env.CODEWIND_AUTH_HOST) {
        try {
          socketAuthFunctions.addAuthenticationToUISocket(this.uiSocket)
        } catch (error) {
          log.error(`UISocket : Adding authentication error - ${util.inspect(error)}`);
        }
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
    } catch (err) {
      // Reset run load flag and config in the project, and re-throw the error
      project.loadInProgress = false;
      project.loadConfig = null;
      throw err;
    }
  }

  /**
   * Function to cancel load on project
   */
  async cancelLoad(project) {
    log.debug("cancelLoad: project " + project.projectID + " loadInProgress=" + project.loadInProgress);

    if (project.loadInProgress) {
      project.loadInProgress = false;
      log.debug("Cancelling load for config: " + JSON.stringify(project.loadConfig));
      this.uiSocket.emit('runloadStatusChanged', { projectID: project.projectID, status: 'cancelling' });
      let cancelLoadResp = await this.loadRunner.cancelRunLoad(project.loadConfig);
      this.uiSocket.emit('runloadStatusChanged', { projectID: project.projectID, status: 'cancelled' });
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
    }))
    return this.projectList.list;
  }

  /**
   * Function to get watchList for all open projects
   */
  async getWatchList() {
    let watchList = {
      projects: []
    };
    let projectArray = this.projectList.getAsArray();
    for (const project of projectArray) {
      // Only include enabled projects
      if (project.isOpen()) {
        if (project.projectWatchStateId == undefined) {
          const watchStateId = crypto.randomBytes(16).toString("hex");
          const projectUpdate = { projectID: project.projectID, projectWatchStateId: watchStateId };
          await this.projectList.updateProject(projectUpdate);
        } 
        let projectUpdate = {
          projectID: project.projectID,
          projectWatchStateId: project.projectWatchStateId,
          pathToMonitor: project.pathToMonitor,
          ignoredPaths: project.ignoredPaths,
          projectCreationTime: project.creationTime
        }
        watchList.projects.push(projectUpdate);
      }
    }
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

  async imagePushRegistryStatus(body) {
    log.info(`Updating image push registry status for project ${body.projectID}.`);
    try{
      await this.fw.imagePushRegistryStatus(body);
    } catch (err) {
      log.error(`Error in imagePushRegistryStatus`);
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
    let projectID = project.projectID;
    // Stop streaming the logs files.
    project.stopStreamingAllLogs();

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
        this.user.uiSocket.emit('projectClosed', { ...updatedProject, status: 'success' });
        log.debug('project ' + projectID + ' successfully closed');
      } else throw err;
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
   * Function to get status of image push registry in workspace settings file
   */
  async getImagePushRegistryStatus() {
    // workspaceSettingsFile is the path inside PFE Container
    const workspaceSettingsFile = path.join(this.directories["config"], "settings.json");
    let contents;
    let isImagePushRegistrySet = false;
    log.info(`Checking PFE & workspace settings image push registry`);

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
      throw err;
    }

    if (contents && contents.registryAddress && contents.registryAddress.length > 0 && contents.registryNamespace != null) {
      log.debug(`Workspace settings registryAddress: ` + contents.registryAddress);
      log.debug(`Workspace settings registryNamespace: ` + contents.registryNamespace);
      isImagePushRegistrySet = true;

      // trigger the FW workspaceSettings.readWorkspaceSettings() function to load up the cache since it's valid
      log.info(`Workspace settings file present, reading the settings file`);
      await this.readWorkspaceSettings();
    } else {
      log.info("Registry address or registry namespace not found in the workspace settings file");
    }
    log.info(`Workspace settings image push registry status: ${isImagePushRegistrySet}`);

    const workspaceSettings = {
      imagePushRegistry: isImagePushRegistrySet
    }

    if (isImagePushRegistrySet) {
      workspaceSettings.address = contents.registryAddress
      workspaceSettings.namespace = contents.registryNamespace
    }

    return workspaceSettings;
  }
  /**
   * Function to read workspace settings
   */
  async readWorkspaceSettings() {
    try {
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
  async writeWorkspaceSettings(address, namespace) {
    let retval;
    try {
      log.info(`Writing workspace settings file.`);
      retval = await this.fw.writeWorkspaceSettings(address, namespace);
    } catch (err) {
      log.error(`Error in writeWorkspaceSettings`);
      throw err;
    }
    log.debug(`writeWorkspaceSettings return value: ` + JSON.stringify(retval));
    return retval;
  }

  /**
   * Function to get test image push registry
   */
  async testImagePushRegistry(address, namespace) {
    let retval;
    try {
      retval = await this.fw.testImagePushRegistry(address, namespace);
    } catch (err) {
      log.error(`Error in testImagePushRegistry`);
      throw err;
    }
    return retval;
  }

  /**
   * Function to setup the Docker config file. In Kubernetes, the function also creates the Codewind secret from
   * the Docker config and patches the Service Account with the created Codewind Secret. On local, this is skipped.
   * This API function is needed in local because some project stacks pull images from private registries like Appsody.
   */
  async setupRegistrySecret(credentials, address) {
    const credentialsJSON = JSON.parse(Buffer.from(credentials, "base64").toString());
    if (credentialsJSON.username == undefined || credentialsJSON.password == undefined) {
      throw new RegistrySecretsError("INVALID_ENCODED_CREDENTIALS", "for address " + address);
    }
    const username = credentialsJSON.username;
    const password = credentialsJSON.password;
    log.info("Setting up the Docker Registry secret for address: " + address + " and username: " + username);
    const registrySecretList = [];
    let jsonObj;
    
    try {
      // Handle dockerhub specifically on local since docker.io does not work
      if (address === "docker.io" && !global.codewind.RUNNING_IN_K8S) {
        // eslint-disable-next-line no-param-reassign
        address = "https://index.docker.io/v1/";
      }
      const isDockerConfigFilePresent = await cwUtils.fileExists(this.dockerConfigFile)
      const encodedAuth = Buffer.from(username + ":" + password).toString("base64");

      if (isDockerConfigFilePresent) {
        log.info("The Docker config file exists, reading the contents");
        jsonObj = await fs.readJson(this.dockerConfigFile);

        for (let key in jsonObj.auths) {
          const registrySecret = {
            address: key,
            username: jsonObj.auths[key].username
          };
          registrySecretList.push(registrySecret);
          if (key == address) {
            throw new RegistrySecretsError("REGISTRY_DUPLICATE_URL", "for address " + address);
          }
        }

        jsonObj.auths[address] = {
          "username":username,
          "password":password,
          "auth":encodedAuth
        }

        await fs.writeJson(this.dockerConfigFile, jsonObj);
      } else {
        log.info("The Docker config file does not exist, writing the contents");
        jsonObj = {"auths":{}}
        jsonObj.auths[address] = {
          "username":username,
          "password":password,
          "auth":encodedAuth
        }

        await fs.writeJson(this.dockerConfigFile, jsonObj);
      }
      // Update the registrySecretList to send back to the caller
      const registrySecret = {
        address: address,
        username: username
      };
      registrySecretList.push(registrySecret);
      log.info("The Docker config file has been updated for " + address);
    } catch (err) {
      const msg = "Failed to update the Codewind Docker Config File";
      log.error(msg);
      throw err;
    }

    // Only update the Kube secret when running in K8s
    let serviceAccountPatchData;
    if (global.codewind.RUNNING_IN_K8S) {
      serviceAccountPatchData = await this.updateServiceAccountWithDockerRegisrySecret();
    }

    if (serviceAccountPatchData === undefined || !global.codewind.RUNNING_IN_K8S) {
      // when either the service account is patched successfully or we are in local Codewind, we can return
      log.debug("Codewind Docker Registry List: " + JSON.stringify(registrySecretList));
      return registrySecretList;
    }

    const msg = "Reverting changes to the Docker Config";
    log.error(msg);
    
    // Since patching the Service Account failed, we need to revert the update to the Docker Config and patch the Service Account again
    delete jsonObj.auths[address];
    await fs.writeJson(this.dockerConfigFile, jsonObj);
    await this.updateServiceAccountWithDockerRegisrySecret();

    throw new RegistrySecretsError(serviceAccountPatchData, "for address " + address);
  }

  /**
   * Function to create the Kubernetes Secret and patch the Service Account with the created Secret
   */
  async updateServiceAccountWithDockerRegisrySecret() {
    log.info("Creating a Secret and patching the Service Account");
    const isDockerConfigFilePresent = await cwUtils.fileExists(this.dockerConfigFile);
    if (isDockerConfigFilePresent) {
      try {
        log.info("The Docker config file exists, reading contents");
        const jsonObj = await fs.readJson(this.dockerConfigFile);
        const encodedDockerConfig = Buffer.from(JSON.stringify(jsonObj)).toString("base64");

        // Get the Kube Secret labeled with app=codewind-pfe and codewindWorkspace=<workspace_id> and delete if it exists
        let resp = await this.k8Client.api.v1.namespaces(process.env.KUBE_NAMESPACE).secret.get({ qs: { labelSelector: "app=codewind-pfe,codewindWorkspace=" + process.env.CHE_WORKSPACE_ID } });
        if (resp.body.items.length > 0) {
          const secretName = resp.body.items[0].metadata.name;
          await this.k8Client.api.v1.namespaces(process.env.KUBE_NAMESPACE).secrets(secretName).delete();
        }

        // Get the Codewind PVC name and uid for Secret's owner reference
        resp = await this.k8Client.api.v1.namespaces(process.env.KUBE_NAMESPACE).persistentvolumeclaims(process.env.PVC_NAME).get();
        const ownerReferenceName = resp.body.metadata.name;
        const ownerReferenceUID = resp.body.metadata.uid;

        // Create the new secret with the encoded data
        const secret = {
          "apiVersion": "v1",
          "kind": "Secret",
          "metadata": {
            "labels": {
              "app": "codewind-pfe",
              "codewindWorkspace": process.env.CHE_WORKSPACE_ID
            },
            "name": `${this.codewindPFESecretName.substring(0, 62)}`,
            "ownerReferences": [
              {
                "apiVersion": "apps/v1",
                "blockOwnerDeletion": true,
                "controller": true,
                "kind": "ReplicaSet",
                "name": `${ownerReferenceName}`,
                "uid": `${ownerReferenceUID}`
              }
            ]
          },
          "type": "kubernetes.io/dockerconfigjson",
          "data": {
            ".dockerconfigjson": `${encodedDockerConfig}`
          }
        };
        await this.k8Client.api.v1.namespaces(process.env.KUBE_NAMESPACE).secret.post({body: secret});
      } catch (err) {
        log.error(err);
        log.error("Failed to create the Codewind Secret");
        return "SECRET_CREATE_FAILED";
      }

      try {
      // Patch the Service Account with the new secret
        const patch = {
          "imagePullSecrets": [
            {
              "name": `${this.codewindPFESecretName}`
            }
          ]
        };
        await this.k8Client.api.v1.namespaces(process.env.KUBE_NAMESPACE).serviceaccounts(process.env.SERVICE_ACCOUNT_NAME).patch({body: patch});
        log.info("The Service Account has been patched with the created Secret");
      } catch (err) {
        log.error(err);
        log.error("Failed to patch the Service Account");
        return "SERVICE_ACCOUNT_PATCH_FAILED";
      }
    } else {
      // updateServiceAccountWithDockerRegisrySecret was called but there was no Docker Config, error out
      const msg = "No Docker Config found but was requested to patch Service Account.";
      log.error(msg);
      return "NO_DOCKER_CONFIG";
    }

    return undefined;
  }

  /**
   * Function to get the docker registries in PFE
   */
  async getRegistrySecretList() {
    const registrySecretList = [];
    try {
      const isDockerConfigFilePresent = await cwUtils.fileExists(this.dockerConfigFile)
      if (isDockerConfigFilePresent) {
        log.info("Docker Config file present, returning the Docker Registry List");
        const jsonObj = await fs.readJson(this.dockerConfigFile);

        for (let key in jsonObj.auths) {
          const registrySecret = {
            address: key,
            username: jsonObj.auths[key].username
          };
          registrySecretList.push(registrySecret);
        }
      } else {
        log.info("No Docker Config file present, no Docker Registry List to return");
      }
    
      log.debug("Codewind Docker Registry List: " + JSON.stringify(registrySecretList));
    } catch (err) {
      const msg = "Failed to get the Codewind Docker Config Registries";
      log.error(msg);
      throw err;
    }
    
    return registrySecretList;
  }

  /**
   * Function to remove the registry secret from the Docker Config. In Kubernetes, the function also creates the Codewind secret from
   * the Docker config and patches the Service Account with the created Codewind Secret. On local, this is skipped. 
   * This API function is needed in local because some project stacks pull images from private registries like Appsody.
   */
  async removeRegistrySecret(address) {
    const registrySecretList = [];
    let jsonObj;
    let registrySecretToBeDeleted;

    try {
      // Handle dockerhub specifically on local since docker.io does not work
      if (address === "docker.io" && !global.codewind.RUNNING_IN_K8S) {
        // eslint-disable-next-line no-param-reassign
        address = "https://index.docker.io/v1/";
      }
      const isDockerConfigFilePresent = await cwUtils.fileExists(this.dockerConfigFile)
      if (isDockerConfigFilePresent) {
        log.info("Docker Config file present, removing the specified Docker Registry from the list");
        jsonObj = await fs.readJson(this.dockerConfigFile);
        let isSecretDeleted = false;

        for (let key in jsonObj.auths) {
          if (key == address) {
            registrySecretToBeDeleted = jsonObj.auths[key];
            delete jsonObj.auths[key];
            isSecretDeleted = true;
          } else {
            const registrySecret = {
              address: key,
              username: jsonObj.auths[key].username
            };
            registrySecretList.push(registrySecret);
          }
        }

        if (!isSecretDeleted) {
          // If there is no Secret deleted or no Secret to delete in the Docker Config, throw an error. Dont update the Kubernetes Secret and Service Account.
          const msg = "Unable to find the registry secret to delete for address " + address;
          log.error(msg);
          throw new RegistrySecretsError("SECRET_DELETE_MISSING", "for address " + address);
        }

        await fs.writeJson(this.dockerConfigFile, jsonObj);
        log.info("The Docker config file has been updated for removal of " + address);
      } else {
        // return if there is no Docker Config file, no need to create new Kubernetes Secret or patch the Service Account
        throw new RegistrySecretsError("NO_DOCKER_CONFIG", "for removing address " + address);
      }
    } catch (err) {
      const msg = "Failed to remove the registry secret and update the Codewind Docker Config File";
      log.error(msg);
      throw err;
    }

    // Only update the Kube secret when running in K8s
    let serviceAccountPatchData;
    if (global.codewind.RUNNING_IN_K8S) {
      serviceAccountPatchData = await this.updateServiceAccountWithDockerRegisrySecret();
    }

    if (serviceAccountPatchData === undefined || !global.codewind.RUNNING_IN_K8S) {
      // when either the service account is patched successfully or we are in local Codewind, we can return
      log.debug("Codewind Docker Registry List: " + JSON.stringify(registrySecretList));
      return registrySecretList;
    }

    const msg = "Reverting changes to the Docker Config";
    log.error(msg);

    // Since patching the Service Account failed, we need to revert the delete from the Docker Config and patch the Service Account again
    jsonObj.auths[address] = registrySecretToBeDeleted;
    await fs.writeJson(this.dockerConfigFile, jsonObj);
    await this.updateServiceAccountWithDockerRegisrySecret();

    throw new RegistrySecretsError(serviceAccountPatchData, "for address " + address);
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
    } catch (err) {
      log.error(`Error setting log level on filewatcher module`);
      log.error(err);
    }
  }
}
