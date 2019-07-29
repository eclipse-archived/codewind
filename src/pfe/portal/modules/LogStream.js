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

const { spawn } = require('child_process');
const cwUtils = require('./utils/sharedFunctions');
const Logger = require('./utils/Logger');
const logger = new Logger('LogStream.js');
const path = require('path');

const LOG_EMIT_TIMEOUT = 1000;

/**
* The LogStream class
* Represents the active log streams to the UI for
* a project.
*/
module.exports = class LogStream {

  /**
   * Factory method to create LogStream objects
   *
   * @param {*} project the project the stream belongs to.
   * @param {*} uiSocket the socket to emit log-update events on.
   * @param {*} logType the type of log (app or build)
   * @param {*} logOrigin the origin of the log, within the container or within the workspace
   * @param {*} logName the name of the log
   * @param {*} logFile the file log updates are written to
   */
  static createLogStream(project, uiSocket, logType, logOrigin, logName, logFile) {

    logger.debug(`Creating LogStream for: ${logType} ${logOrigin} ${logName} ${logFile} `)

    if (logOrigin == 'container' && logType == 'app') {
      return new ApplicationContainerLogStream(project, uiSocket, logType);
    } else if (logOrigin == 'workspace') {
      return new WorkspaceFileLogStream(project, uiSocket, logType, logName, logFile);
    }
    // TODO (when needed) - Files in containers and build logs from build containers.
    // } else if (logOrigin == 'container' && logType == 'build') {
    //   return new BuildContainerLogStream(project, uiSocket);
    // } else if (logOrigin == 'workspace') {
    //   return new ContainerFileLogStream(project, uiSocket, logName, logFile);
    // }
    throw new Error('Unknown log type.');
  }
}

class ApplicationContainerLogStream {

  /**
   * Create a log stream that streams output from a container.
   *
   * @param project the project the container belongs to.
   * @param uiSocket the socket to emit log-update events on.
   * @param logType the type of log
   */
  constructor (project, uiSocket, logType) {
    this.project = project;
    this.uiSocket = uiSocket;
    this.logType = logType;
    this.logName = '-';
    this.logPath = '';
    this.firstChunk = true;
    this.stream = undefined;
    this.sendQueue = [];
    this.stopped = true;
  }

  resetStream() {
    logger.debug(`Resetting stream for container for project ${this.project.projectID} (${this.project.name})`);
    // Throw away any unsent messages.
    this.sendQueue = [];
    this.firstChunk = true;
  }

  /**
   * Function to start transmission of the container log of the project
   */
  streamLog() {
    // Make 'this' accessible in the callback.
    const logStream = this;
    logStream.stopped = false;
    cwUtils.getContainerLogStream(this.project, function (project, stream) {
      logStream.firstChunk = true;
      logStream.stream = stream;
      stream.on('data', (chunk) => {
        // if on Kubernetes, ignore logs about rpc error no such container
        // these are issued when the project changes as the pods change
        const errorString = 'rpc error: code = Unknown desc = Error: No such container:'
        const chunkString = chunk.toString('utf8')
        if (!global.codewind.RUNNING_IN_K8S || chunkString.indexOf(errorString) == -1) {
          logStream.sendQueue.push(chunkString);
          logger.debug(`Emit done for ${project.projectID} (${project.name}) container log`);
        }
      });
      logStream.stream.on('end', () => {
        logger.debug(`container logStream for ${project.projectID} (${project.name}) ended.`);
      });
      setTimeout(emitQueued, LOG_EMIT_TIMEOUT, logStream);
    });
  }

  /**
   * Function to end transmission of the container log of the project
   */
  stop() {
    logger.debug(`Stopping streaming: ${this.logName} for ${this.project.name}, ${this.project.projectID}`);
    this.stopped = true;
    if (this.stream) {
      this.stream.destroy();
      this.stream = undefined;
    }
  }
}

class WorkspaceFileLogStream {

  constructor (project, uiSocket, logType, logName, logFile) {
    this.project = project;
    this.uiSocket = uiSocket;
    this.logType = logType;
    this.logName = logName;
    this.logFile = logFile;
    this.logPath = path.dirname(logFile);
    this.firstChunk = true;
    this.tail = undefined;
    this.sendQueue = [];
    this.stopped = true;
  }

  resetStream() {
    logger.debug(`Resetting stream for ${this.logType} ${this.logName}.`);
    // Throw away any unsent messages.
    this.sendQueue = [];
    this.firstChunk = true;
  }

  /**
   * Function to start streaming a log file
   */
  streamLog() {
    // Make 'this' accessible in the callback.
    const logStream = this;
    logStream.stopped = false;
    logger.debug(`Streaming log file: ${this.logFile}`);
    // Start streaming by stopping the existing stream.
    this.tail = spawn('tail', ['-q', '-F', '-c', '+0', this.logFile]);
    logger.debug(`Log tailing command is: ${this.tail.spawnargs.join(' ')}`);
    // TODO - check if process is still running..... listening to event
    // might be too late.
    this.tail.on('error', function (err) {
      logger.debug(`tail failed with:`);
      logger.debug(err);
    })
    this.tail.on('close', function (code, signal) {
      logger.debug(`tail exited with rc = ${code} via signal ${signal}`);
    })
    this.tail.stderr.on('data', (chunk) => {
      logger.debug(`tail stderr: ${chunk}`);
      // This should mean the file has been re-created.
      this.firstChunk = true;
    });
    this.tail.stdout.on('data', (chunk) => {
      const chunkString = chunk.toString('utf8');
      logStream.sendQueue.push(chunkString);
      logger.debug(`Emit queued for ${this.project.name}, ${this.project.projectID}`);
    });
    this.tail.stdout.on('error', (err) => {
      logger.debug(err);
      this.stop();
    });
    this.tail.stdout.on('finish', () => {
      logger.debug(`log ${this.logName}, file: ${this.logFile} end reached.`);
      // TODO - Should we restart here if this happened because
      // the file was reset. (If so pass the callback - how do we tell
      // the stream wasn't closed deliberately rather than by the log changing.)
      this.stop();
    });
    // Emit every one second to prevent us sending hundreds of messages
    // in one go when re-opening large logs but keep the UI responsive.
    setTimeout(emitQueued, LOG_EMIT_TIMEOUT, logStream);
  }

  /**
   * Function to stop streaming a log file
   */
  stop() {
    logger.debug(`Stopping streaming: ${this.logFile} for ${this.project.name}, ${this.project.projectID}`);
    this.stopped = true;
    if (this.tail) {
      // Stop listening now so we don't get events triggered by kill()
      this.tail.stdout.removeAllListeners();
      this.tail.stderr.removeAllListeners();
      this.tail.kill();
      this.tail = undefined;
    }
  }
}

function emitQueued(logStream) {
  // Emit any pending log updates.
  if (logStream.sendQueue.length > 0) {
    // Grab the current set of messages before doing
    // anything that might be asynchronous.
    const messages = logStream.sendQueue;
    logStream.sendQueue = [];

    // The messages should already include carriage returns where
    // neccessary.
    const logs = messages.join('');

    const logUpdate = {
      projectName: logStream.project.name,
      projectID: logStream.project.projectID,
      logType: logStream.logType,
      logName: logStream.logName,
      logPath: logStream.logPath,
      logs: logs,
      reset: logStream.firstChunk
    }
    let reset = logStream.firstChunk;
    logStream.firstChunk = false;
    logStream.uiSocket.emit('log-update', logUpdate);
    logger.debug(`Batched emit done for ${logStream.project.name}, ${logStream.project.projectID} (${logStream.logName}) ${messages.length} messages, reset: ${reset}`);
  }

  // Repeat again in 1 second.
  if (!logStream.stopped) {
    setTimeout(emitQueued, LOG_EMIT_TIMEOUT, logStream);
  }
}
