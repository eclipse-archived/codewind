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

const dateFormat = require('dateformat');
const fs = require('fs-extra');
const io = require('socket.io-client');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const path = require('path');
const http = require('http');

const Logger = require('./utils/Logger');
const cwUtils = require('./utils/sharedFunctions');
const docker = require('./utils/dockerFunctions');
const LoadRunError = require('./utils/errors/LoadRunError');

const mkDirAsync = promisify(fs.mkdir);
const log = new Logger(__filename);

/**
* The LoadRunner class
* Contains functions to:
*    - Listen to Socket message from the LoadRunner container
*    - Reconnect to the LoadRunner if we disconnect or timeout
* One per User
*/
module.exports = class LoadRunner {
  constructor(user) {
    this.user = user;
    this.hostname = process.env.CODEWIND_PERFORMANCE_SERVICE ? process.env.CODEWIND_PERFORMANCE_SERVICE : "codewind-performance"
    this.port = '9095';
    this.project = null;
    this.collectingHCD = false;
    this.runDescription = null;
    this.up = false;
    this.socket = io(`http://${this.hostname}:${this.port}`, { timeout: 5000, autoConnect: false });
    this.collectionUri = null;
    this.profilingSocket = null;
    this.metricsFeatures = {};
    this.createSocketEvents();
    this.connectIfAvailable();
    this.timerID = null;
    this.heartbeatID = null;
  }

  // Fetch the supported metrics features from the project
  async fetchProjectMetricsFeatures() {
    log.info("Fetching project metrics features")
    const metricsContextRoot = this.project.getMetricsContextRoot();
    let options = {
      host: this.project.host,
      port: this.project.getPort(),
      path: `/${metricsContextRoot}/api/v1/collections/features`,
      method: 'GET',
    }

    // when available get the connection details from the project service
    if (this.project.kubeServiceHost && this.project.kubeServicePort ) {
      options.host = this.project.kubeServiceHost;
      options.port = this.project.kubeServicePort;
    }

    log.info(`Connection options:  ${JSON.stringify(options)}`);
    try {
      const featureRequest = await cwUtils.asyncHttpRequest(options);
      log.info(`Status code = ${featureRequest.statusCode}`);
      if (featureRequest.statusCode == 200) {
        this.metricsFeatures = JSON.parse(featureRequest.body);
        log.info(`Metrics features are : ${JSON.stringify( this.metricsFeatures )}`);
      } else {
        this.metricsFeatures = {};
        log.error(`Unable to fetch project metrics features. HTTP Status code : ${featureRequest.statusCode}`);
      }
    } catch (err) {
      this.metricsFeatures = {};
      log.error(`Unable to get project metrics features: ${JSON.stringify(err)}`);
    }
  }

  /**
   * Call metrics API to create a collection
   *
   * @returns collection URI (eg 'collections/0')
   */
  async createCollection(seconds) {
    const metricsContextRoot = this.project.getMetricsContextRoot();

    let collection = null;
    try {
      let options = {
        host: this.project.host,
        port: this.project.getPort(),
        path: `/${metricsContextRoot}/api/v1/collections`,
        method: 'POST',
      }

      // If the project metrics support timed metrics set a fixed time recording
      if (this.metricsFeatures && this.metricsFeatures.timedMetrics) {
        options.path = `/${metricsContextRoot}/api/v1/collections/${seconds}`
      } else {
        this.user.uiSocket.emit('runloadStatusChanged', { projectID: this.project.projectID,  status: 'app-is-using-old-metrics' });
      }

      // when available get the connection details from the project service
      if (this.project.kubeServiceHost && this.project.kubeServicePort ) {
        options.host = this.project.kubeServiceHost;
        options.port = this.project.kubeServicePort;
      }

      log.info(`createCollection: ID:${this.project.projectID}, Host:${options.host}, Port:${options.port}, Path:${options.path}`);

      let metricsRes = await cwUtils.asyncHttpRequest(options);
      log.debug('createCollection: metricsRes.statusCode=' + metricsRes.statusCode);
      switch (metricsRes.statusCode) {
      case 201:
        collection = metricsRes.headers.location;
        break;
      case 400:
        log.error('createCollection: too many metrics collections ' + metricsRes.statusCode);
        break;
      default:
        log.error('createCollection: unable to create metrics collection: ' + metricsRes.statusCode);
        break;
      }
    } catch (err) {
      log.error('createCollection: Error in function createCollection');
      log.error(err);
    }
    return collection;
  }

  /**
   * Call metrics API to retrieve metrics and then delete the collection
   *
   * @param host
   * @param port
   * @param metricsContextRoot
   *          ('appmetrics' | 'javametrics' | 'swiftmetrics')
   * @param collectionUri
   *          (eg 'collections/0')
   * @param metricsFolder
   *          folder in which to write metrics file
   * @returns
   */
  async recordCollection() {
    let options = {
      host: this.project.host,
      port: this.project.getPort(),
      path: '/' + this.project.getMetricsContextRoot() + `/api/v1/` + this.collectionUri,
      method: 'GET',
    }

    // when available get the connection details from the project service
    if (this.project.kubeServiceHost && this.project.kubeServicePort ) {
      options.host = this.project.kubeServiceHost;
      options.port = this.project.kubeServicePort;
    }

    if (this.metricsFeatures && this.metricsFeatures.timedMetrics) {
      options.path = '/' + this.project.getMetricsContextRoot() + `/api/v1/` + this.collectionUri + "/stashed";
    }

    try {
      // Get the metrics collection
      let metricsRes = await cwUtils.asyncHttpRequest(options);
      let metricsJson = "";
      log.info(`Requested metrics from project container reported : ${metricsRes.statusCode}`);
      switch (metricsRes.statusCode) {
      case 200:
        metricsJson = JSON.parse(metricsRes.body);
        if (this.runDescription != null) {
          metricsJson.desc = this.runDescription;
        }
        try {
          await fs.writeJson(this.workingDir + '/metrics.json', metricsJson, { spaces: '  ' });
        } catch (err) {
          log.error(err);
        }
        break;
      default:
        log.error('recordCollection: unable to get metrics collection: ' + metricsRes.statusCode);
      }
    } catch (err) {
      log.error('recordCollection: Error occurred');
      log.error(err);
    }

    // If appmetrics does not support timed collections (which get auto delete when published), delete them now.
    if (!this.metricsFeatures || !this.metricsFeatures.timedMetrics) {
      const deleteOptions = {
        ...options,
        method: 'DELETE',
      };
      http.request(deleteOptions, function (res) {
        if (res.statusCode == 204) {
          log.info('recordCollection: Metrics collection deleted');
        } else {
          log.error('recordCollection: Unable to delete metrics collection: ' + res.statusCode);
        }
      }).on('error', function (err) {
        log.error('recordCollection: Unable to delete metrics collection');
        log.error(err);
      }).end();
    }
  }


  /**
   * Function to run a load test
   *
   * @param loadConfig the load configuration to run against the project
   * @param newProject the project to run the load against.
   * @param runDesc a text description of the run.
   */
  async runLoad(loadConfig, targetProject, runDesc) {
    log.debug('runLoad: loadConfig=' + JSON.stringify(loadConfig));
    log.debug('runLoad: project=' + JSON.stringify(targetProject));
    if (this.project != null) {
      throw new LoadRunError("RUN_IN_PROGRESS", `For project ${this.project.name} (${this.project.projectID})`);
    }
    if (this.up) {
      this.project = targetProject;
      if (runDesc) {
        this.runDescription = runDesc;
      } else {
        this.runDescription = null;
      }
      let options = {
        host: this.hostname,
        port: this.port,
        path: '/api/v1/runload',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }

      await this.createResultsDirectory();

      // Update project endpoints
      await this.project.getProjectKubeService();

      // Update metrics features
      await this.fetchProjectMetricsFeatures();

      if (this.project.git) {
        const hasChanges = await this.project.git.hasChanges();
        if (!hasChanges) {
          this.writeGitHash();
        }
      }

      this.heartbeat('preparing');

      // start profiling if supported by current language
      if (this.project.language == 'nodejs' || this.project.language === 'javascript') {
        this.beginNodeProfiling();
      } else if (this.project.language == 'java' && this.project.projectType == 'liberty') {
        await this.beginJavaProfiling(loadConfig.maxSeconds);
      }

      //  Start collection on metrics endpoint (this must be started AFTER java profiling since java profiling will restart the liberty server)
      this.collectionUri = await this.createCollection(loadConfig.maxSeconds);
      this.heartbeat('starting');

      // Send the load run request to the loadrunner microservice
      let loadrunnerRes = await cwUtils.asyncHttpRequest(options, loadConfig);
      switch (loadrunnerRes.statusCode) {
      case 202:
        break;
      default:
        await this.cancelProfiling();
        this.project = null;
        log.error(`runLoad (${loadrunnerRes.statusCode} received)'`);
      }
      return loadrunnerRes;
    }
    throw new LoadRunError('CONNECTION_FAILED');
  }

  /**
   * @param mode false = wait for health to disappear,  true = wait for health to appear
   */
  async waitForHealth(mode) {
    // wait for /health to become available indicating that liberty has restarted
    const CONST_WAIT = (1000 * 10)  // 10 seconds
    const CONST_MAX_RETRIES = 12;  // timeout after 12 * 1000
    for (let i = 0; i < CONST_MAX_RETRIES; i++) {
      // eslint-disable-next-line no-await-in-loop
      await cwUtils.timeout(5000);
      try {
        let options = {
          host: this.project.host,
          port: this.project.getPort(),
          path: '/health',
          method: 'GET'
        }

        // when available get the connection details from the project service
        if (this.project.kubeServiceHost && this.project.kubeServicePort ) {
          options.host = this.project.kubeServiceHost;
          options.port = this.project.kubeServicePort;
        }

        // eslint-disable-next-line no-await-in-loop
        let httpCheckHealth = await cwUtils.asyncHttpRequest(options);

        log.info(`httpCheckHealth ${httpCheckHealth.statusCode}`);
        if (mode && httpCheckHealth.statusCode === 200) {
          log.info("LibertyServer has responded to /health");
          break;
        }
      } catch (err) {
        log.info(err);
        if (mode) {
          // eslint-disable-next-line no-await-in-loop
          await cwUtils.timeout(CONST_WAIT);
        } else {
          break;
        }
      }
    }
  }

  async beginJavaProfiling(duration) {
    // set the flag to false
    this.collectingHCD = false;
    // round up time to next minute
    const durationInMins = Math.ceil(duration / 60);

    // the load test directory inside the docker container
    const loadTestDir = path.join('/', 'home', 'default', 'app', 'load-test', this.metricsFolder);

    const javaVersion = this.getLibertyJavaVersion();

    const unsupportedJavaVersions = /8\.0\.5\.(27|30)/;
    if (unsupportedJavaVersions.test(javaVersion)) {
      log.warn('Version of Java used by this project is not supported, Java profiling will not be started');
      return;
    }

    // For Java Liberty restart the server in preparation for profiling
    if (this.project.language == 'java' && this.project.projectType == 'liberty') {
      log.info(`beginJavaProfiling: Stopping liberty server`);
      const stopCommand = ['bash', '-c', `source $HOME/artifacts/envvars.sh; $HOME/artifacts/server_setup.sh; cd $WLP_USER_DIR;  /opt/ibm/wlp/bin/server stop; `];
      await cwUtils.spawnContainerProcess(this.project, stopCommand);
      await this.waitForHealth(false);
      this.heartbeat('connecting');
      log.info(`beginJavaProfiling: Starting liberty server`);
      const startCommand = ['bash', '-c', `source $HOME/artifacts/envvars.sh; $HOME/artifacts/server_setup.sh; cd $WLP_USER_DIR;  /opt/ibm/wlp/bin/server start; `];
      await cwUtils.spawnContainerProcess(this.project, startCommand);
      await this.waitForHealth(true);
    }

    const mkdirCommand = `mkdir -p ${loadTestDir}`;
    const mkdirArray = ['bash', '-c', mkdirCommand];

    await cwUtils.spawnContainerProcess(this.project, mkdirArray);

    const healthCentercommand = `export javapid=(\`pidof java\`); java -jar $JAVA_HOME/jre/lib/ext/healthcenter.jar ID=\${javapid[-1]} level=headless -Dcom.ibm.java.diagnostics.healthcenter.headless.run.number.of.runs=1 -Dcom.ibm.java.diagnostics.healthcenter.headless.run.duration=${durationInMins} -Dcom.ibm.java.diagnostics.healthcenter.headless.output.directory=${loadTestDir} -Dcom.ibm.diagnostics.healthcenter.data.memory=off -Dcom.ibm.diagnostics.healthcenter.data.memorycounters=off -Dcom.ibm.diagnostics.healthcenter.data.cpu=off -Dcom.ibm.diagnostics.healthcenter.data.environment=off -Dcom.ibm.diagnostics.healthcenter.data.locking=off -Dcom.ibm.diagnostics.healthcenter.data.memory=off -Dcom.ibm.diagnostics.healthcenter.data.threads=off`;
    const healthCenterArray = ['bash', '-c', healthCentercommand];

    try {
      await cwUtils.spawnContainerProcess(this.project, healthCenterArray);
    } catch (error) {
      log.error(error)
    }
    this.collectingHCD = true;
    this.timerID = setTimeout(() => this.getJavaHealthCenterData(1), duration * 1000);
  }

  async getJavaHealthCenterData(counter) {
    clearTimeout(this.heartbeatID);
    if (counter > 20) {
      log.error("getJavaHealthCenterData: Failed to save .hcd file");
      this.collectingHCD = false;
      this.emitCompleted();
      return;
    }
    try {
      await this.project.getProfilingByTime(this.metricsFolder);
    } catch (error) {
      if (this.project !== null) {
        const data = { projectID: this.project.projectID,  status: 'collecting' , timestamp: this.metricsFolder }
        this.user.uiSocket.emit('runloadStatusChanged', data);
        log.info(`getJavaHealthCenterData: .hcd file not found, trying again. Attempt ${counter}/20`);
        this.timerID = setTimeout(() => this.getJavaHealthCenterData(counter + 1), 3000);
      } else {
        log.warn("getJavaHealthCenterData: Project was made null before .hcd could be found.")
      }
      return;
    }
    log.info("getJavaHealthCenterData: .hcd copied to PFE");
    this.collectingHCD = false;
    const data = { projectID: this.project.projectID,  status: 'hcdReady', timestamp: this.metricsFolder};
    this.user.uiSocket.emit('runloadStatusChanged', data);
    this.emitCompleted();
  }

  async getLibertyJavaVersion() {
    const libertyLogPath = '/logs/messages.log';
    const logFile = await docker.readFile(this.project, libertyLogPath);

    let logFileLines = logFile.split('\n');
    logFileLines = logFileLines.filter(line => line.startsWith('java.runtime'));
    return logFileLines[0];
  }

  async createResultsDirectory() {
    // Create working directory
    let now = new Date();
    this.metricsFolder = dateFormat(now, 'yyyymmddHHMMss');

    this.workingDir = path.join(this.project.loadTestPath, this.metricsFolder);
    log.debug(this.workingDir);

    try {
      await mkDirAsync(this.workingDir);
    } catch (err) {
      throw new LoadRunError('RESULTS_DIR_FAILED');
    }
  }

  /**
   * Write a file called runinfo.json with the git hash in
   * like this
   * {"gitHash": "039be5033f3192ad7721b9678f5630264c667692"}
   */

  async writeGitHash() {
    const hashValue = await this.project.git.getLastCommitHash();
    let hashObject = { gitHash: hashValue };
    const filePath = path.join(this.workingDir, 'runinfo.json');
    try {
      await fs.writeJson(filePath, hashObject, { spaces: '  ' });
    } catch (err) {
      log.error(err);
    }
  }

  /**
  * Function to cancel the loadrunner
  */
  async cancelRunLoad(loadConfig) {
    if (this.heartbeatID !== null) {
      clearTimeout(this.heartbeatID);
    }
    try {
      let options = {
        host: this.hostname,
        port: this.port,
        path: '/api/v1/cancelLoad',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }
      let cancelLoadResp = await cwUtils.asyncHttpRequest(options, loadConfig);
      return cancelLoadResp;
    } catch (err) {
      log.error('cancelRunLoad: Error occurred');
      log.error(err);
    }
    throw new LoadRunError('CONNECTION_FAILED');
  }

  /**
  * Create the socket when loadrunner is available.
  */
  connectIfAvailable() {
    this.socket.connect();
  }

  /**
  * Create socket and event listeners
  */
  createSocketEvents() {

    /**
    * Socket event for connect
    * Logs connection success
    */
    this.socket.on('connect', () => {
      log.info('Loadrunner has connected')
      this.up = true;
    });

    /**
    * Socket event for disconnect
    * Logs the error and starts reconnect procedure
    */
    this.socket.on('disconnect', () => {
      log.info('Loadrunner has disconnected')
      // If this.up is false we're already trying to reconnect
      if (this.up) {
        // socket.io-client will automatically reconnect and trigger the connect event.
        this.up = false;
      }
    });

    /**
    * Socket event for connection timeout
    * Logs the error and starts reconnect procedure
    */
    this.socket.on('connect_timeout', () => {
      log.info('Loadrunner has timed out')
      // If this.up is false we're already trying to reconnect
      if (this.up) {
        // socket.io-client will automatically reconnect and trigger the connect event.
        this.up = false;
      }
    });

    /**
    * Socket event for error
    * Logs the error and starts reconnect procedure
    */
    this.socket.on('error', (err) => {
      log.error('LoadRunner socket error');
      // A socket error could occur while a load run is not in progress.
      if (this.project) {
        this.project.loadInProgress = false;
      }
      log.error(err);
      // If this.up is false we're already trying to reconnect
      if (this.up) {
        // socket.io-client will automatically reconnect and trigger the connect event.
        this.up = false;
      }
    });

    this.socket.on('started', () => {
      if (this.project) {
        log.info(`Load run on project ${this.project.projectID} started`);
        clearTimeout(this.heartbeatID);
        this.user.uiSocket.emit('runloadStatusChanged', { projectID: this.project.projectID, status: 'started' });
        this.heartbeat('running');
      } else {
        log.warn(`Unexpected 'started' message.`);
      }
    });

    this.socket.on('cancelled', async () => {
      if (this.project) {
        log.info(`Load run on project ${this.project.projectID} cancelled`);
        this.heartbeat('cancelling');
        await this.cancelProfiling();

        this.user.uiSocket.emit('runloadStatusChanged', { projectID: this.project.projectID, status: 'cancelled' });
        this.project = null;
        clearTimeout(this.heartbeatID);
      } else {
        log.warn(`Unexpected 'cancelled' message.`);
      }
    });

    this.socket.on('completed', async () => {
      if (this.project) {
        log.info(`Load run on project ${this.project.projectID} completed`);
        this.project.loadInProgress = false;   // Clear the flag on the project
        if (this.collectionUri !== null) {
          this.recordCollection();
        }

        await this.endProfiling();
      } else {
        log.warn(`Unexpected 'completed' message.`);
      }
    });
  }

  /**
   * Enable appmetrics profiling and listen for profiling
   * samples.
   */
  beginNodeProfiling() {
    log.debug(`beginProfiling: Connecting to appmetrics socket ws://${this.project.host}:${this.project.getPort()}/appmetrics-dash/socket.io`);

    let samples = [];
    this.profilingSocket = io(`ws://${this.project.host}:${this.project.getPort()}/`, {
      transport: ['websocket'],
      path: '/appmetrics-dash/socket.io',
      autoConnect: false,
    });
    this.profilingSamples = samples;

    this.profilingSocket.on('connect', function () {
      // Enable profiling.
      log.debug(`beginProfiling: Enabling appmetrics profiling`);
      this.emit('enableprofiling');
    });
    // Add the listener for the profiling event before we enable profiling.
    this.profilingSocket.on('profiling', (profilingSample) => {
      try {
        samples.push(JSON.parse(profilingSample));
      } catch (err) {
        log.error('Invalid JSON in profiling sample.');
        log.error(err);
      }
    });
    this.profilingSocket.on('disconnect', function () {
      log.debug(`Disconnected profiling.`)
    });
    // Make sure we don't miss the 'connect' event.
    this.profilingSocket.open();
  }

  /**
   * Save profiling samples to disk in the metrics folder.
   * The samples are written to a file as a JSON array of samples.
   */
  async endProfiling() {
    if (this.profilingSocket !== null) {
      try {
        const profilingPath = path.join(this.workingDir + '/profiling.json');
        await fs.writeJson(profilingPath, this.profilingSamples, { spaces: '  ' });
      } catch(err) {
        log.error('endProfiling: Error writing profiling samples');
        log.error(err);
      }
      log.info(`profiling.json saved for project ${this.project.name}`);

      try {
        await this.postProcessProfilingData();
      } catch (err) {
        log.error('endProfiling: Error post processing profiling data.');
        log.error(err);
      }

      const data = { projectID: this.project.projectID, status: 'profilingReady', timestamp: this.metricsFolder }
      this.user.uiSocket.emit('runloadStatusChanged', data);
      this.profilingSocket.emit('disableprofiling');
      this.profilingSocket.disconnect();
      this.profilingSocket = null;
      this.profilingSamples = null;
    }
    this.emitCompleted();
  }

  async postProcessProfilingData() {
    /* Run the merge out of process as the profiling data could potentially be quite large. */
    const profilingPath = path.join(this.workingDir + '/profiling.json');
    const normalisedProfilingPath = this.project.getPathToProfilingTreeFile(this.metricsFolder);
    const mergeCommand = `${process.execPath} /portal/scripts/mergeNodeProfiles.js ${profilingPath} ${normalisedProfilingPath}`;
    log.debug(`Running: ${mergeCommand}`);
    const mergeProcess = await exec(mergeCommand);
    log.trace(mergeProcess.stdout);
    log.trace(mergeProcess.stderr);
    log.debug('Merging done');

    const summarisedProfilingPath = this.project.getPathToProfilingSummaryFile(this.metricsFolder);
    const summariseCommand = `${process.execPath} /portal/scripts/summariseProfile.js ${normalisedProfilingPath} ${summarisedProfilingPath}`;
    log.debug(`Running: ${summariseCommand}`);
    const summariseProcess = await exec(summariseCommand);
    log.trace(summariseProcess.stdout);
    log.trace(summariseProcess.stderr);
    log.debug('Summarising done');
  }

  async cancelProfiling() {
    if (this.profilingSocket !== null) {
      this.profilingSocket.emit('disableprofiling');
      this.profilingSocket.disconnect();
      this.profilingSocket = null;
    }
    if (this.timerID !== null) {
      clearTimeout(this.timerID);
      log.info(`cancelProfiling: Stopping liberty server`);
      const stopCommand = ['bash', '-c', `source $HOME/artifacts/envvars.sh; $HOME/artifacts/server_setup.sh; cd $WLP_USER_DIR;  /opt/ibm/wlp/bin/server stop; `];
      await cwUtils.spawnContainerProcess(this.project, stopCommand);
      await this.waitForHealth(false);
      log.info(`cancelProfiling: Starting liberty server`); 
      const startCommand = ['bash', '-c', `source $HOME/artifacts/envvars.sh; $HOME/artifacts/server_setup.sh; cd $WLP_USER_DIR;  /opt/ibm/wlp/bin/server start; `];
      await cwUtils.spawnContainerProcess(this.project, startCommand);
      await cwUtils.deleteFile(this.project, cwUtils.getProjectSourceRoot(this.project), `load-test/${this.metricsFolder}`);
      await this.waitForHealth(true);
      await this.project.removeProfilingData(this.metricsFolder);
      this.timerID = null;
    }
  }

  /**
  * Function to shutdown the user's projects and their loadrunner.
  */
  async shutdown() {
    const socket = this.socket;

    // If the loadrunner is running we do a full shutdown, calling the loadrunner to close
    // down the user's projects before we remove the user's loadrunner.
    if (this.up) {
      let options = {
        host: this.hostname,
        port: this.port,
        path: '/api/v1/cancel',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }
      // Send the shutdown HTTP request to the loadrunner so they can close the user's projects. On
      // the 200 response we remove the pod.
      let loadrunnerRes = await cwUtils.asyncHttpRequest(options);
      switch (loadrunnerRes.statusCode) {
      case 200:
      case 400: // no run in progress
        break;
      case 500:
        log.error(`shutdown: error sending cancel request (500 received)`);
        break;
      default:
        log.error(`shutdown: (${loadrunnerRes.statusCode} received)`);
      }
    }
    this.up = false;
    socket.disconnect();
  }

  /**
   * Function to send a heartbeat of the current LoadRunner status
   */
  heartbeat(status) {
    if (this.heartbeatID !== null) {
      clearTimeout(this.heartbeatID);
    }
    this.heartbeatID = setInterval(() => this.user.uiSocket.emit('runloadStatusChanged', { projectID: this.project.projectID,  status: status, timestamp: this.metricsFolder }), 2000);
  }

  emitCompleted() {
    if (!this.collectingHCD) {
      this.user.uiSocket.emit('runloadStatusChanged', { projectID: this.project.projectID,  status: 'completed' });
      clearTimeout(this.heartbeatID);
      this.project = null;
    }
  }
}
