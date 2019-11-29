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

[
  require('./projects'),
  require('./environment.route'),
  require('./ignoredPaths.route'),
  require('./templates.route'),
  require('./locale.route'),
  require('./imagePushRegistry.route'),
  require('./registrySecrets.route'),
  require('./logging.route'),
  require('./projectTypes.route'),
  require('./extensions.route'),
]
  .forEach((subRouter) => router.use(subRouter));

module.exports = router;
