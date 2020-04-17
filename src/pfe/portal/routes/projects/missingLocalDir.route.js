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
const express = require('express');

const Logger = require('../../modules/utils/Logger');

const router = express.Router();
const log = new Logger(__filename);

const { checkProjectExists } = require('../../middleware/checkProjectExists');
const { validateReq } = require('../../middleware/reqValidator');

/**
 * API Function to emit a missingLocalDir message on the UI socket
 * @return {res.code} 200 if socket message emitted successfully
 * @return {res.code} 500 if internal error
 */

router.post(`/api/v1/projects/:id/missingLocalDir`, validateReq, checkProjectExists, (req, res) => {
  const user = req.cw_user
  const projectID = req.sanitizeParams('id');
  try {
    user.uiSocket.emit('missingLocalDir', {
      projectID,
    })
    res.sendStatus(200)
  } catch (err) {
    log.error(err);
    res.status(500).send(err.info || err);
  }
});

module.exports = router;
