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

const MetricsStatusError = require('../utils/errors/MetricsStatusError')
const Logger = require('../utils/Logger');
const log = new Logger('metricsStatusChecker.js');

const filesToCheck = {
  java : 'pom.xml',
  nodejs : 'package.json',
  swift : 'Package.swift',
}

/**
 * @param {*} projectPath
 * @param {*} projectLanguage
 * @returns {Promise<Boolean>} The projects supports metrics,
 * based on the values of its build-file.
 */
async function isMetricsAvailable(projectPath, projectLanguage) {
  log.debug(`checking if metricsAvailable for ${projectLanguage} project`);
  const fileToCheck = filesToCheck[projectLanguage];
  if (!fileToCheck) {
    return false; // not a language with supported metrics
  }
  const pathOfFileToCheck = await path.join(projectPath, fileToCheck);
  if (await fs.pathExists(pathOfFileToCheck)) {
    return doesMetricsPackageExist(pathOfFileToCheck, projectLanguage)
  }
  throw new MetricsStatusError("BUILD_FILE_MISSING", `Cannot find project build-file (${fileToCheck})`);
}

async function doesMetricsPackageExist(pathOfFileToCheck, projectLanguage) {
  let metricsPackageExists = false; // default to appmetrics unavailable
  try {
    const fileToCheck = await fs.readFile(pathOfFileToCheck, 'utf8');
    if (projectLanguage === 'nodejs') {
      const packageJSON = JSON.parse(fileToCheck);
      const { dependencies } = packageJSON;
      if (dependencies) {
        if (dependencies['appmetrics-dash']) {
          metricsPackageExists = true;
        }
      }
    } else if (projectLanguage === 'java') {
      metricsPackageExists = fileToCheck.includes('javametrics-dash') // for liberty
        || fileToCheck.includes('javametrics-spring'); // for spring
    } else if (projectLanguage === 'swift') {
      metricsPackageExists = fileToCheck.includes('SwiftMetrics.git');
    }
  } catch(err) {
    // If we failed to read the file / parse json return false
  }
  log.debug(`doesMetricsPackageExist returning ${metricsPackageExists}`);
  return metricsPackageExists;
}

module.exports = {
  isMetricsAvailable,
}
