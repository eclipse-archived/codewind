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

const Logger = require('../modules/utils/Logger');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API Function to return the list of available codewind extensions
 * @return the set of condewind extensions as a JSON array
 */
router.get('/api/v1/extensions', (req, res) => {
  try {
    const user = req.cw_user;
    let extensions = [];
    let list = user.extensionList.getNames();
    for (let key of list) {
      extensions.push(user.extensionList.retrieve(key));
    }
    res.status(200).send(extensions);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

module.exports = router;
