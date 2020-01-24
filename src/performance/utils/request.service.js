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

const axios = require('axios');
const { inspect } = require('util');

const Logger = require('../utils/Logger');

const log = new Logger(__filename);

const getResData = async (origin, path) => {
  const href = `${origin}${path}`;
  log.debug(`[getResData] GET ${href}`);
  try {
    const res = await axios.get(href);
    log.trace(`[getResData] GET ${href} Received res.data: ${inspect(res.data)}`);
    return res.data;
  } catch (error) {
    throw new Error(`GET ${href} failed: ${inspect(error.response.data)}`);
  }
};

const makePostRequest = async (origin, path) => {
  const href = `${origin}${path}`;
  log.debug(`[makePostRequest] POST ${href}`);
  try {
    const res = await axios.post(href);
    log.trace(`[makePostRequest] POST ${href} Received res.data: ${inspect(res.data)}`);
    return res.data;
  } catch (error) {
    throw new Error(`POST ${href} failed: ${inspect(error.response.data)}`);
  }
};

module.exports = {
  getResData,
  makePostRequest,
};
