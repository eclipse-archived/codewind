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
const { repeatFunc, allPromisesSettled } = require('../utils/utils.service');

// TODO: reset
const numPolls = 10;
const latestProjectData = {};

const getEnvData = (appOrigin) => getResData(appOrigin, '/metrics/environment');

const getMetricsFromProject = async (appOrigin) => {
  const projectData = latestProjectData[appOrigin];
  if (!projectData.hasOwnProperty('metrics')) {
    projectData.metrics = {}
  }
  const [
    metricsFromUser,
    metricsFromCodewind,
  ] = await allPromisesSettled([
      getResData(appOrigin, '/metrics'),
      getResData(appOrigin, '/metrics/codewind'),
  ]);

  projectData.metrics.fromUser = metricsFromUser;
  projectData.metrics.fromCodewind = metricsFromCodewind;
}

const getProfilingDataFromProject = async (appOrigin) => {
  const projectData = latestProjectData[appOrigin];
  if (!projectData.hasOwnProperty('profiling')) {
    projectData.profiling = {};
  }
  const profilingData = await getResData(appOrigin, '/metrics/profiling');
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
  console.log(`Finished polling project at ${appOrigin}`);
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
