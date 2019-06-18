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
  require('./build.route'),
  require('./cancelLoad.route'),
  require('./capabilities.route'),
  require('./close.route'),
  require('./compare.route'),
  require('./invalidNameChars.route'),
  require('./metrics.route'),
  require('./open.route'),
  require('./watchList.route'),
  require('./projects.route'),
  require('./restart.route'),
  require('./loadtest.route'),
  require('./logStream.route'),
  require('./internal.route'),
  require('./binding.route'),
  require('./fileChanges.route')
]
  .forEach((subRouter) => router.use(subRouter));

module.exports = router;