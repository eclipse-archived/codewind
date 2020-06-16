const fs = require('fs-extra');
const path = require('path');
const util = require('util');

const Logger = require('../../modules/utils/Logger');
const { deepClone } = require('../../modules/utils/sharedFunctions');

const log = new Logger(__filename);

const getPathToPackageJson = (projectDir) => path.join(projectDir, 'package.json');
const getPathToBackupPackageJson = (projectDir) => path.join(projectDir, 'backupPackage.json');

async function injectMetricsCollectorIntoNodeProject(projectDir) {
  const pathToBackupPackageJson = getPathToBackupPackageJson(projectDir);

  const pathToPackageJson = getPathToPackageJson(projectDir);
  if (!(await fs.exists(pathToPackageJson))) {
    throw new Error(`no package.json at '${pathToPackageJson}'`);
  }
  const originalContentsOfPackageJson = await fs.readJSON(pathToPackageJson);

  validatePackageJson(originalContentsOfPackageJson);

  await fs.copy(pathToPackageJson, pathToBackupPackageJson);

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
  const pathToPackageJson = getPathToPackageJson(projectDir);

  await fs.copy(pathToBackupPackageJson, pathToPackageJson);
  log.trace(`Restored project's package.json from ${pathToBackupPackageJson}`);
  await fs.remove(pathToBackupPackageJson);

}

function getNewContentsOfPackageJson(originalContentsOfPackageJson) {
  const newContentsOfPackageJson = deepClone(originalContentsOfPackageJson);

  newContentsOfPackageJson.scripts.start = getNewStartScript(originalContentsOfPackageJson.scripts.start);
  newContentsOfPackageJson.dependencies = {
    ...newContentsOfPackageJson.dependencies,
    'appmetrics-codewind': '^0.2.0',
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
