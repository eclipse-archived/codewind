const fs = require('fs-extra');
const path = require('path');
const util = require('util');

const Logger = require('../utils/Logger');
const { deepClone } = require('../utils/sharedFunctions');

const log = new Logger(__filename);

const getPathToPackageJson = (projectDir) => path.join(projectDir, 'package.json');
const getPathToBackupPackageJson = (projectDir) => path.join(projectDir, 'backupPackage.json');

async function injectMetricsCollectorIntoNodeProject(projectDir) {
  const pathToBackupPackageJson = getPathToBackupPackageJson(projectDir);
  if (await fs.exists(pathToBackupPackageJson)) {
    throw new Error('project files already backed up (i.e. we have already injected metrics collector)');
  }

  const pathToPackageJson = getPathToPackageJson(projectDir);
  if (!(await fs.exists(pathToPackageJson))) {
    throw new Error(`no package.json at '${pathToPackageJson}'`);
  }
  const originalContentsOfPackageJson = await fs.readJSON(pathToPackageJson);

  validatePackageJson(originalContentsOfPackageJson);
  await fs.writeJSON(pathToBackupPackageJson, originalContentsOfPackageJson, { spaces: 2 });

  const newContentsOfPackageJson = getNewContentsOfPackageJson(originalContentsOfPackageJson);
  log.trace(`Injecting metrics collector into project's package.json, which is now ${ util.inspect(newContentsOfPackageJson) }`);

  await fs.writeJSON(pathToPackageJson, newContentsOfPackageJson, { spaces: 2 });
}

function validatePackageJson(packageJson) {
  const packageJsonHasStartScript = packageJson.scripts && packageJson.scripts.start;
  if (!packageJsonHasStartScript) {
    throw new Error('package.json missing script: start');
  }
}

async function removeMetricsCollectorFromNodeProject(projectDir) {
  const pathToBackupPackageJson = getPathToBackupPackageJson(projectDir);
  const backupPackageJson = await fs.readJSON(pathToBackupPackageJson);

  const pathToPackageJson = getPathToPackageJson(projectDir);
  await fs.writeJSON(pathToPackageJson, backupPackageJson, { spaces: 2 });
  log.trace(`Restored project's package.json to ${ util.inspect(backupPackageJson) }`);

  await fs.remove(pathToBackupPackageJson);
}

function getNewContentsOfPackageJson(originalContentsOfPackageJson) {
  const newContentsOfPackageJson = deepClone(originalContentsOfPackageJson);

  newContentsOfPackageJson.scripts.start = getNewStartScript(originalContentsOfPackageJson.scripts.start);
  newContentsOfPackageJson.dependencies = {
    ...newContentsOfPackageJson.dependencies,
    'appmetrics-codewind': '^0.1.0',
  }
  return newContentsOfPackageJson;
}

function getNewStartScript(originalStartScript) {
  const metricsCollectorScript = '-r appmetrics-codewind/attach';

  if (originalStartScript.includes(metricsCollectorScript)) {
    return originalStartScript;
  }

  const splitOriginalStartScript = originalStartScript.split(' ');
  const indexOfNodeCmd = splitOriginalStartScript.findIndex(word => ['node', 'nodemon'].includes(word));

  let newStartScript = deepClone(splitOriginalStartScript);
  newStartScript.splice(indexOfNodeCmd + 1, 0, metricsCollectorScript);
  newStartScript = newStartScript.join(' ');

  return newStartScript;
}

module.exports = {
  injectMetricsCollectorIntoNodeProject,
  removeMetricsCollectorFromNodeProject,
};
