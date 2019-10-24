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

const fs = require('fs-extra');
const path = require('path');

// const Logger = require('./utils/Logger');

// const log = new Logger('MetricsCollector.js');
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const metricsCollectorInjectionFunctions = {
  nodejs: injectMetricsCollectorIntoNodeProject,
}

async function injectMetricsCollectorIntoProject(projectDir) {
  const projectType = 'nodejs';
  await metricsCollectorInjectionFunctions[projectType](projectDir);
}

async function injectMetricsCollectorIntoNodeProject(projectDir) {
  const pathToPackageJson = path.join(projectDir, 'package.json');
  const oldContentsOfPackageJson = await fs.readJSON(pathToPackageJson);
  console.log('oldContentsOfPackageJson');
  console.log(oldContentsOfPackageJson);

  const newContentsOfPackageJson = getNewContentsOfPackageJson(oldContentsOfPackageJson);
  console.log('newContentsOfPackageJson');
  console.log(newContentsOfPackageJson);

  await fs.writeJSON(pathToPackageJson, newContentsOfPackageJson, { spaces: 2 });
}

function getNewContentsOfPackageJson(oldContentsOfPackageJson) {
  const oldStartScript = oldContentsOfPackageJson.scripts.start.split(' ');
  const indexOfNodeCmd = oldStartScript.findIndex(word => ['node', 'nodemon'].includes(word));

  let newStartScript = deepClone(oldStartScript);
  newStartScript.splice(indexOfNodeCmd + 1, 0, '-r appmetrics-dash/attach -r codewind-node-metrics/attach');
  newStartScript = newStartScript.join(' ');

  const newContentsOfPackageJson = deepClone(oldContentsOfPackageJson);

  newContentsOfPackageJson.scripts.start = newStartScript;
  newContentsOfPackageJson.dependencies['codewind-node-metrics'] = "git+https://git@github.com/rwalle61/codewind-node-metrics.git#wip-for-demo";
  return newContentsOfPackageJson;
}


module.exports = {
  injectMetricsCollectorIntoProject,
}
