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
const { getResData, makePostRequest } = require('../utils/request.service');
const { repeatFunc, allPromisesSettled } = require('../utils/utils.service');

const numPolls = 1000; // maxPolls * pollInterval = 2000000ms of data ~= 33 mins
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
};

const getProfilingDataFromProject = async (appOrigin) => {
  const projectData = latestProjectData[appOrigin];
  if (!projectData.hasOwnProperty('profiling')) {
    projectData.profiling = {};
  }
  const profilingData = await getResData(appOrigin, '/metrics/profiling');
  projectData.profiling = profilingData;
};

const enableProfilingOnProject = async (appOrigin) => {
  await makePostRequest(appOrigin, '/metrics/profiling/on');
};

const disableProfilingOnProject = async (appOrigin) => {
  await makePostRequest(appOrigin, '/metrics/profiling/off');
};

const scrapeNodejsProjectData = async (appOrigin) => {
  await enableProfilingOnProject(appOrigin);
  await Promise.all([
    repeatFunc(
      () => getMetricsFromProject(appOrigin),
      numPolls,
    ),
    repeatFunc(
      () => getProfilingDataFromProject(appOrigin),
      numPolls,
    ),
  ]);
  await disableProfilingOnProject(appOrigin);
};

const scrapeProjectData = async (appOrigin, projectLanguage) => {
  if (!latestProjectData.hasOwnProperty(appOrigin)) {
    latestProjectData[appOrigin] = {};
  }
  if (projectLanguage === 'nodejs') {
    return scrapeNodejsProjectData(appOrigin);
  }
  await repeatFunc(
    () => getMetricsFromProject(appOrigin),
    numPolls,
  );
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
