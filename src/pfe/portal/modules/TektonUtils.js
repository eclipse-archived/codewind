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

const Client = require('kubernetes-client').Client
const config = require('kubernetes-client').config;

const cwUtils = require('./utils/sharedFunctions');
const Logger = require('./utils/Logger');

const ERR_TEKTON_SERVICE_NOT_INSTALLED = "not-installed";
const ERR_TEKTON_NO_DASHBOARD_LIST = "no-dashboard-list";
const ERR_TEKTON_NO_DASHBOARD = "no-dashboard";
const ERR_TEKTON_NO_DASHBOARD_URL = "no-dashboard-url"

const log = new Logger(__filename);

/**
 * Determine the Tekton API service connection details {host:port}
 */
async function getTektonAPIService() {
  try {
    const client = new Client({ config: config.getInCluster(), version: '1.9' });
    const tktNamespaceName = process.env.TEKTON_PIPELINE;
    log.info(`Looking for services in Tekton namespace '${tktNamespaceName}'`);
    const services = await client.api.v1.namespaces(tktNamespaceName).services.get({ qs: { labelSelector: 'app=tekton-dashboard-internal' } });
    if (services && services.body &&
      services.body.items[0] &&
      services.body.items[0].spec &&
      services.body.items[0].spec.ports &&
      services.body.items[0].spec.ports[0]) {
      const clusterIP = services.body.items[0].spec.clusterIP;
      const port = services.body.items[0].spec.ports[0].port;
      if (port && clusterIP) {
        log.info(`Tekton API service found: ${clusterIP}:${port}`);
        return { host: clusterIP, port: port }
      }
      log.info(`Unable to find Tekton service in namespace '${tktNamespaceName}'`);
      return null;
    }
  } catch (err) {
    log.error(`Unexpected error determining Tekton API Service: ${JSON.stringify(err)}`);
  }
  return null;
}

/**
 * Reads the data from 
 * {getTektonAPIService}/v1/namespaces/{namespace}/endpoints
 * and returns the API response containing at least 1 Tekton dashboard URL
 */
async function getTektonDashboardList(tektonAPIService) {
  const tektonNamespace = process.env.TEKTON_PIPELINE;
  if (!tektonAPIService) {
    log.error('getTektonDashboardList: Unable to determine API Service');
    return null;
  }
  try {
    const options = {
      host: tektonAPIService.host,
      port: tektonAPIService.port,
      path: `/v1/namespaces/${tektonNamespace}/endpoints`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
    const response = await cwUtils.asyncHttpRequest(options);
    switch (response.statusCode) {
    case 200: {
      const jsonResponse = JSON.parse(response.body);
      if (jsonResponse && jsonResponse.length > 0 && jsonResponse[0].url) {
        return jsonResponse;
      }
      return null;
    }
    default:
      log.error('getTektonDashboardList: response.statusCode=' + response.statusCode);
      break;
    }
  } catch (err) {
    log.error(`Unexpected error getting Tekton Dashboard list: ${JSON.stringify(err)}`);
  }
  return null;
}

/**
 * Return the first URL in the list of URLs returned by the Tekton Dashboard API.
 */
async function getTektonDashboardUrl() {
  if (!global.codewind.RUNNING_IN_K8S) {
    return "";
  }

  let tektonDashList = null;
  let tektonDashboardURL = null;

  try {
    const tektonAPIService = await getTektonAPIService();
    if (!tektonAPIService) {
      return {status: false, message: ERR_TEKTON_SERVICE_NOT_INSTALLED, url: ''};
    }

    tektonDashList = await getTektonDashboardList(tektonAPIService);
    if (!tektonDashList) {
      return {status: false, message: ERR_TEKTON_NO_DASHBOARD_LIST, url: ''};
    }

  } catch (err) {
    log.error(`Error getting Dashboard list: ${err}`);
    return {status: false, message: ERR_TEKTON_NO_DASHBOARD, url: ''};
  }

  if (tektonDashList && tektonDashList.length > 0 && tektonDashList[0].url) {
    tektonDashboardURL = tektonDashList[0].url;
  } else {
    log.error(`Unable to find a Tekton dashboard URL`);
    return {status:false, message: ERR_TEKTON_NO_DASHBOARD_URL, url: ''};
  }

  log.info(`Tekton DashboardURL = ${tektonDashboardURL}`);
  return {status: true, message:'', url: tektonDashboardURL};
}

module.exports.getTektonDashboardUrl = getTektonDashboardUrl;
module.exports.ERR_TEKTON_SERVICE_NOT_INSTALLED = ERR_TEKTON_SERVICE_NOT_INSTALLED;
