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
const { getProjectFromReq } = require('./checkProjectExists');

const router = (req) => {
  const { protocol } = req;
  const { host, ports: { internalPort }} = getProjectFromReq(req);
  return {
    protocol: `${protocol}:`, // The : is required
    host: host,
    port: internalPort,
  };
}

const pathRewrite = (path, req) => {
  const id = req.sanitizeParams('id');
  return path.replace(`/links/proxy/${id}`, '');
}

// proxy middleware options
const options = {
  target: 'http://codewind-pfe', // target field is required but we overwrite it with the customRouter
  changeOrigin: true, // needed for virtual hosted sites
  ws: true, // proxy websockets
  router,
  pathRewrite,
};

const projectLinkProxy = createProxyMiddleware(options);

module.exports = {
  projectLinkProxy,
}
