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
const Logger = require('./utils/Logger');
const log = new Logger(__filename);

function verifyLock(req, res, _next) {
  const { templates: templatesController } = req.cw_user;
  const locked = templatesController.isLocked();
  if (locked) {
    log.debug(`Templates attempted to be accessed while locked at endpoint: ${req.originalUrl}`);
    return res.status(409).send('template lock hit, they are currently being updated');
  }
  return _next();
}

module.exports = {
  verifyLock,
};
