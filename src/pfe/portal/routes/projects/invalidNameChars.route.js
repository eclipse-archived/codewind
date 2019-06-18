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
const express = require('express');

const Logger = require('../../modules/utils/Logger');
const { ILLEGAL_PROJECT_NAME_CHARS } = require('../../config/requestConfig');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to get the characters which can't be used in a project name
 * @return {res.code} 200 if invalid char list returned successfully
 * @return {res.code} 500 if internal error
 */

router.get('/api/v1/projects/invalidNameChars', (req, res) => {
  try {
    res.status(200).json({ illegalNameChars: ILLEGAL_PROJECT_NAME_CHARS });
  } catch (err) {
    log.error(err);
    res.status(500).send(err.info || err);
  }
});
  
module.exports = router;