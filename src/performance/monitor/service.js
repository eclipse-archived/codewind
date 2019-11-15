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
const { getResData } = require('../utils/request.service');
const { repeatFunc } = require('../utils/utils.service');

const numPolls = 100;
const latestProjectData = {};

const getEnvData = (appOrigin) => getResData(appOrigin, '/metrics/codewind/environment');

const getMetricsFromProject = async (appOrigin) => {
  const projectData = latestProjectData[appOrigin];
  if (!projectData.hasOwnProperty('metrics')) {
    projectData.metrics = {}
  }
  const [
    metricsFromUser,
    metricsFromCodewind,
  ] = await Promise.all([
    getResData(appOrigin, '/metrics')
      .catch(err => console.log(err.message)),
    getResData(appOrigin, '/metrics/codewind')
      .catch(err => console.log(err.message)),
  ]);

  projectData.metrics.fromUser = metricsFromUser;
  projectData.metrics.fromCodewind = metricsFromCodewind;
}

const getProfilingDataFromProject = async (appOrigin) => {
  const projectData = latestProjectData[appOrigin];
  if (!projectData.hasOwnProperty('profiling')) {
    projectData.profiling = {};
  }
  const profilingData = await getResData(appOrigin, '/metrics/codewind/profiling');
  projectData.profiling = profilingData;
}

const scrapeProjectData = async (appOrigin, projectLanguage) => {
  if (!latestProjectData.hasOwnProperty(appOrigin)) {
    latestProjectData[appOrigin] = {};
  }
  const promises = [
    repeatFunc(
      () => getMetricsFromProject(appOrigin),
      numPolls,
    ),
  ]
  if (projectLanguage === 'nodejs') {
    promises.push(
      repeatFunc(
        () => getProfilingDataFromProject(appOrigin),
        numPolls,
      )
    );
  }
  await Promise.all(promises);
}

const getLatestProjectData = (appOrigin) => latestProjectData[appOrigin];

const resetProjectData = (appOrigin) => {
  latestProjectData[appOrigin] = {};
}

module.exports = {
  resetProjectData,
  getLatestProjectData,
  scrapeProjectData,
  getEnvData,
};
