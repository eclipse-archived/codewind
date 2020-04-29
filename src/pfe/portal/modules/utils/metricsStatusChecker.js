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

const { asyncHttpRequest } = require('./sharedFunctions');
const Logger = require('../utils/Logger');
const log = new Logger('metricsStatusChecker.js');

const filesToCheck = {
  java : 'pom.xml',
  nodejs : 'package.json',
  javascript : 'package.json',
  swift : 'Package.swift',
}

const METRICS_DASH_HOST = {
  project: 'project',
  performanceContainer: 'performanceContainer',
};

const VALID_METRIC_ENDPOINT = {
  metrics: {
    endpoint: '/metrics',
    hosting: METRICS_DASH_HOST.performanceContainer,
  },
  appmetricsDash: {
    endpoint: '/appmetrics-dash',
    hosting: METRICS_DASH_HOST.project,
  },
  javametricsDash: {
    endpoint: '/javametrics-dash',
    hosting: METRICS_DASH_HOST.project,
  },
  swiftmetricsDash: {
    endpoint: '/swiftmetrics-dash',
    hosting: METRICS_DASH_HOST.project,
  },
  actuatorPrometheus: {
    endpoint: '/actuator/prometheus', // Spring Appsody applications
    hosting: METRICS_DASH_HOST.performanceContainer,
  }
}

const APPMETRIC_ENDPOINTS = [
  VALID_METRIC_ENDPOINT.appmetricsDash.endpoint,
  VALID_METRIC_ENDPOINT.javametricsDash.endpoint,
  VALID_METRIC_ENDPOINT.swiftmetricsDash.endpoint,
];

async function getMetricStatusForProject(project) {
  const { RUNNING_IN_K8S } = global.codewind;
  const { projectID, language, host: hostname, ports: { internalPort }, injectMetrics } = project;
  const projectPath = project.projectPath();
  const metricsContextRoot = project.getMetricsContextRoot();

  let host = hostname;
  let port = internalPort;
  if (RUNNING_IN_K8S) {
    const kubeService = await project.getProjectKubeService();
    host = kubeService.hostname;
    port = kubeService.port;
  }

  // file system checks and get endpoints
  const [appmetricsPackageFoundInBuildFile, microprofilePackageFoundInBuildFile, endpoints] = await Promise.all([
    hasAppmetricsInFileSystem(projectPath, language),
    hasMicroprofileMetricsInFileSystem(projectPath, language),
    getActiveMetricsURLs(host, port),
  ]);

  // endpoint checks
  const metricsEndpoint = (endpoints[VALID_METRIC_ENDPOINT.metrics.endpoint]) ? VALID_METRIC_ENDPOINT.metrics.endpoint : false;
  const [appmetricsEndpoint = false] = Object.keys(endpoints).filter(key => APPMETRIC_ENDPOINTS.includes(key) && endpoints[key]);
  const liveMetricsAvailable = (metricsEndpoint || appmetricsEndpoint) ? true : false;

  // Check if projects appmetrics has the ability to use timed metrics
  // if the project doesn't have a metricsContextRoot, it won't have the appmetrics API
  const hasTimedMetrics = (metricsContextRoot && metricsContextRoot !== '')
    ? await hasTimedMetricsFeature(host, port, metricsContextRoot)
    : false;

  // hosting and path for project.metricsDashboard
  const { hosting, path } = getMetricsDashboardHostAndPath(endpoints, projectID, language, injectMetrics);

  return {
    capabilities: {
      liveMetricsAvailable,
      metricsEndpoint,
      appmetricsEndpoint,
      microprofilePackageFoundInBuildFile,
      appmetricsPackageFoundInBuildFile,
      hasTimedMetrics,
    },
    metricsDashHost: {
      hosting,
      path,
    }
  }
}

/**
 * @param {*} projectPath
 * @param {*} projectLanguage
 * @returns {Promise<Boolean>} The projects supports one of the appmetrics products,
 * based on the values of its build-file.
 */
async function hasAppmetricsInFileSystem(projectPath, projectLanguage) {
  log.debug(`checking if metricsAvailable for ${projectLanguage} project`);
  const fileToCheck = filesToCheck[projectLanguage];
  if (!fileToCheck) {
    return false; // not a language with supported metrics
  }
  const pathOfFileToCheck = path.join(projectPath, fileToCheck);
  const fileExists = await fs.pathExists(pathOfFileToCheck);
  if (!fileExists) {
    return false;
  }

  return doesMetricsPackageExist(pathOfFileToCheck, projectLanguage)
}

async function doesMetricsPackageExist(pathOfFileToCheck, projectLanguage) {
  let metricsPackageExists = false; // default to appmetrics unavailable
  try {
    const fileToCheck = await fs.readFile(pathOfFileToCheck, 'utf8');
    if (projectLanguage === 'nodejs' || projectLanguage === 'javascript') {
      const packageJSON = JSON.parse(fileToCheck);
      // There might not be any dependencies
      if (packageJSON.dependencies) {
        if (packageJSON.dependencies['appmetrics-dash']) {
          metricsPackageExists = true;
        }
      }
    } else if (projectLanguage === 'java') {
      metricsPackageExists = fileToCheck.includes('javametrics');
    } else if (projectLanguage === 'swift') {
      metricsPackageExists = fileToCheck.includes('SwiftMetrics.git');
    }
  } catch(err) {
    // If we failed to read the file / parse json return false
  }
  log.debug(`doesMetricsPackageExist returning ${metricsPackageExists}`);
  return metricsPackageExists;
}

async function hasMicroprofileMetricsInFileSystem(projectPath, projectLanguage) {
  if (projectLanguage !== 'java') return false;
  const filePath = path.join(projectPath, filesToCheck[projectLanguage]);
  const pomExists = await fs.pathExists(filePath);
  if (!pomExists) return false;
  const microprofileString = '<artifactId>microprofile</artifactId>';
  const contents = await fs.readFile(filePath, 'utf8');
  return contents.includes(microprofileString);
}

async function getActiveMetricsURLs(host, port) {
  const endpointsToCheck = Object.keys(VALID_METRIC_ENDPOINT).map((name) => VALID_METRIC_ENDPOINT[name].endpoint);
  const endpoints = await Promise.all(endpointsToCheck.map(async (endpoint) => {
    const isActive = await isMetricsEndpoint(host, port, endpoint);
    return { endpoint, isActive };
  }));

  return endpoints.reduce((acc, { endpoint, isActive }) => {
    acc[endpoint] = isActive;
    return acc;
  }, {});
}

async function isMetricsEndpoint(host, port, path) {
  const { validRes, body } = await makeRequestAndCheckResponse({ host, port, path }, 200);
  if (!validRes || !body) {
    return false;
  }

  const isAppmetrics = isAppmetricsFormat(body);
  const isPrometheus = isPrometheusFormat(body);
  return (isAppmetrics || isPrometheus);
}

function isAppmetricsFormat(html) {
  return html.includes('src="graphmetrics/js');
}

function isPrometheusFormat(string) {
  // Split string by new lines
  const lines = string.split('\n');
  // If the final line is empty, remove it
  if (lines[lines.length-1] === "") lines.pop();
  // Ensure number of spaces on each line is 1 (ignoring comment lines)
  const { length: numberOfValidPrometheusLines } = lines.filter(line => {
    // Ignore lines beginning with # as they are comments
    const lineIsComment = line.startsWith('#');
    // Valid prometheus metrics are in the format "name metric"
    // e.g. api_http_requests_total{method="POST", handler="/messages"} value
    // Remove everything between "{}" and the brackets themselves
    const validatedLine = line.replace(/{.*}/, '');
    // Ensure there is only one space between the metric name and value
    const validMetric = (validatedLine.split(" ").length-1) === 1;
    return lineIsComment || validMetric;
  });
  return lines.length === numberOfValidPrometheusLines;
}

function getMetricsDashboardHostAndPath(endpoints, projectID, projectLanguage) {
  const prioritisedReturnOrder = [
    VALID_METRIC_ENDPOINT.metrics, // enabled but only for Java while performance dashboard is enhanced to support more /metrics endpoints
    // VALID_METRIC_ENDPOINT.actuatorPrometheus, not supported in the performance dashboard
    VALID_METRIC_ENDPOINT.appmetricsDash,
    VALID_METRIC_ENDPOINT.javametricsDash,
    VALID_METRIC_ENDPOINT.swiftmetricsDash,
  ];

  const dashboardObject = prioritisedReturnOrder.find(({ endpoint }) => {
    // For Java use /metrics if possible, fall back to javametrics-dash
    // For Node, force appmetrics-dash while performance dashboard is enhanced to support more /metrics endpoints
    // Everything else should use *metrics-dash as we can't guarantee we support /metrics for anything
    if (endpoint === VALID_METRIC_ENDPOINT.metrics.endpoint && projectLanguage !== 'java') {
      return false;
    }
    return endpoints[endpoint] === true;
  });

  // If no metric endpoints are active, return null
  if (!dashboardObject) {
    return {
      hosting: null,
      path: null,
    }
  }

  const { hosting, endpoint } = dashboardObject;
  const path = getDashboardPath(hosting, endpoint, projectID, projectLanguage);
  return {
    hosting,
    path,
  };
}

function getDashboardPath(metricsDashHost, projectMetricEndpoint, projectID, language, injectMetrics) {
  if (metricsDashHost === METRICS_DASH_HOST.project && !injectMetrics) {
    return `${projectMetricEndpoint}/?theme=dark`;
  }

  // Currently we only support java and nodejs on the performance dashboard
  // if injectMetrics is true, we always show metrics on the performance dashboard
  if (['java', 'nodejs'].includes(language) && (metricsDashHost === METRICS_DASH_HOST.performanceContainer || injectMetrics)) {
    return `/performance/monitor/dashboard/${language}?theme=dark&projectID=${projectID}`
  }

  return null;
}

async function hasTimedMetricsFeature(host, port, metricsContextRoot) {
  const path = `/${metricsContextRoot}/api/v1/collections/features`;
  const { validRes, body } = await makeRequestAndCheckResponse({ host, port, path }, 200);
  // const body = JSON.parse(stringBody);
  let hasTimedMetrics = false;
  const bodyIsString = (typeof body === 'string' || body instanceof String);
  if (bodyIsString) {
    try {
      const parsedBody = JSON.parse(body);
      hasTimedMetrics = parsedBody && (parsedBody.timedMetrics === true || parsedBody.timedMetrics === "true");
    } catch (err) {
      // Response body was a string but we couldn't parse it
      return false;
    }
  } else {
    // body should be an object now
    hasTimedMetrics = body && body.timedMetrics;
  }
  return validRes && hasTimedMetrics;
}

async function makeRequestAndCheckResponse(options, expectedResponse) {
  let res;
  try {
    res = await asyncHttpRequest({
      method: 'GET',
      ...options,
    });
  } catch(err) {
    // If the request errors then the metrics endpoint isn't available
    return { validRes: false, body: null };
  }
  const { statusCode, body } = res;
  const validRes = (statusCode === expectedResponse);
  return { validRes, body };
}

module.exports = {
  getMetricStatusForProject,
}
