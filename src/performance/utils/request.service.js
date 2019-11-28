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

const getResData = async (origin, path) => {
  const href = `${origin}${path}`;
  console.log(`[getResData] GET ${href}`);
  const res = await axios.get(href);
  // console.log('Received res.data');
  // console.log(res.data);
  return res.data;
};

const makePostRequest = async (origin, path) => {
  const href = `${origin}${path}`;
  console.log(`[makePostRequest] POST ${href}`);
  const res = await axios.post(href);
  // console.log('Received res.data');
  // console.log(res.data);
  return res.data;
};

module.exports = {
  getResData,
  makePostRequest,
};
