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
const router = express.Router();
const Logger = require('../../modules/utils/Logger');
const log = new Logger(__filename);

/**
 * API Function to get watchList for all open projects
 * @return the watchList
 * @return 200 if operation success
 * @return 500 if there was an error
 */
router.get('/api/v1/projects/watchlist', async function (req, res) {
  try {
    const user = req.cw_user;
    const watchList = await user.getWatchList();
    res.status(200).send(watchList);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});


module.exports = router;
