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
const got = require('got');

const Logger = require('../modules/utils/Logger');

const log = new Logger(__filename);

// if we are running in Che use the workspace codewind performance service,  else use the codewind container name of "codewind-performance"
const performance_host = process.env.CODEWIND_PERFORMANCE_SERVICE ? process.env.CODEWIND_PERFORMANCE_SERVICE : "codewind-performance";
const performance_port = ':9095';
log.info(`PerformanceHost: ${performance_host}`);

function pipePerfProxyReqsToPerfContainer(req, res) {
  try {
    const options = getOptionsForReqToPerfContainer(req, performance_host, performance_port);
    let reqToPerfContainer
    if (req.method == "POST") {
      reqToPerfContainer = got.stream.post(options);
    } else {
      reqToPerfContainer = got.stream(options);
    }
    req
      .pipe(reqToPerfContainer)
      .on('error', (err) => {
        log.error(err);
        res.status(502).send({ error: err.code});
      })
      .pipe(res);
  } catch (err) {
    log.error(err);
  }
}

function getOptionsForReqToPerfContainer(req, performance_host, performance_port) {
  const newUrl = `http://${performance_host}${performance_port}${req.originalUrl}`;
  log.debug(`Forward req to Perf container: forwarding ${req.originalUrl} to ${newUrl}`);
  const options = { url: newUrl };

  if (req.query.projectID) {
    const project = req.cw_user.projectList.retrieveProject(req.query.projectID);
    options.searchParams = {
      appOrigin: project.appBaseURL || `http://${project.host}:${project.ports.internalPort}`,
      projectLanguage: project.language,
    };
  }
  return options;
}

module.exports = {
  pipePerfProxyReqsToPerfContainer,
}
