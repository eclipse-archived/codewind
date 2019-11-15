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
const util = require('util');

const Logger = require('./utils/Logger');

const log = new Logger('MetricsService.js');
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const metricsCollectorInjectionFunctions = {
  nodejs: injectMetricsCollectorIntoNodeProject,
}

async function injectMetricsCollectorIntoProject(projectLanguage, projectDir) {
  if (!metricsCollectorInjectionFunctions.hasOwnProperty(projectLanguage)) {
    throw new Error(`'${projectLanguage}' is not a supported language`);
  }
  await metricsCollectorInjectionFunctions[projectLanguage](projectDir);
  log.debug(`Successfully injected metrics collector into project's package.json`);
}

async function injectMetricsCollectorIntoNodeProject(projectDir) {
  const pathToPackageJson = path.join(projectDir, 'package.json');
  const oldContentsOfPackageJson = await fs.readJSON(pathToPackageJson);

  const newContentsOfPackageJson = getNewContentsOfPackageJson(oldContentsOfPackageJson);
  log.debug(`Injecting metrics collector into project's package.json, which is now ${util.inspect(newContentsOfPackageJson)}`);

  await fs.writeJSON(pathToPackageJson, newContentsOfPackageJson, { spaces: 2 });
}

function getNewContentsOfPackageJson(oldContentsOfPackageJson) {
  const metricsCollectorScript = '-r appmetrics-prometheus/attach';

  const oldStartScript = oldContentsOfPackageJson.scripts.start;
  if (oldStartScript.includes(metricsCollectorScript)) {
    return oldContentsOfPackageJson;
  }

  const splitOldStartScript = oldStartScript.split(' ');
  const indexOfNodeCmd = splitOldStartScript.findIndex(word => ['node', 'nodemon'].includes(word));

  let newStartScript = deepClone(splitOldStartScript);
  newStartScript.splice(indexOfNodeCmd + 1, 0, metricsCollectorScript);
  newStartScript = newStartScript.join(' ');

  const newContentsOfPackageJson = deepClone(oldContentsOfPackageJson);

  newContentsOfPackageJson.scripts.start = newStartScript;
  newContentsOfPackageJson.dependencies['appmetrics-prometheus'] = "git+https://git@github.com/rwalle61/appmetrics-prometheus.git#host-metrics-on-codewind-endpoint";
  newContentsOfPackageJson.dependencies['cors'] = "^2.8.5"; // Needed because appmetrics-prometheus depends on `cors`, and for some reason when the project runs `npm install`, it doesn't install `cors`
  return newContentsOfPackageJson;
}


module.exports = {
  injectMetricsCollectorIntoProject,
}
