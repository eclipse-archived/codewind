/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
const { createProxyMiddleware } = require('http-proxy-middleware');
const { getProjectFromReq } = require('../middleware/checkProjectExists');

const ENDPOINT = '/links/proxy';
const EXPRESS_ENDPOINT = `${ENDPOINT}/:id`;

const getFullProxyEndpoint = (projectID) => {
  return `${ENDPOINT}/${projectID}`;
};

// Custom Proxy Router
const customRouter = (req) => {
  const { protocol } = req;
  const { host, ports: { internalPort }} = getProjectFromReq(req);
  return {
    protocol: `${protocol}:`, // The : is required
    host: host,
    port: internalPort,
  };
}

// Custom Proxy Path Rewrite (remove the proxy endpoint)
const pathRewrite = (path, req) => {
  const id = req.sanitizeParams('id');
  const proxyEndpoint = getFullProxyEndpoint(id);
  return path.replace(proxyEndpoint, '');
}

const projectLinkProxy = createProxyMiddleware({
  target: 'http://codewind-pfe', // target field is required but we overwrite it with the customRouter
  changeOrigin: true, // needed for virtual hosted sites
  ws: true, // proxy websockets
  router: customRouter,
  pathRewrite,
});

const createProxyURL = (targetProjectID) => {
  const proxyEndpoint = getFullProxyEndpoint(targetProjectID);
  return new URL(`http://${process.env.HOSTNAME}:9090${proxyEndpoint}`);
}

module.exports = {
  EXPRESS_ENDPOINT,
  projectLinkProxy,
  createProxyURL,
}
