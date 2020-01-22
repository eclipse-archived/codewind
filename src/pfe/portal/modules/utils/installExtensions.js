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

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const utils = require('./sharedFunctions');
const Logger = require('./Logger');
const log = new Logger(__filename);

const defaultExtensionsDir = '/extensions';
const extensionsPattern = /^(\S+)-(\d+\.\d+\.\d+|latest)\.zip$/; // e.g. extension-name-0.0.1.zip
const versionPattern = /^\d+[.]\d+[.]\d+$/; // e.g. 0.0.1
const SUFFIX_OLD = '__old';
const odoExtensionName = "codewind-odo-extension";

/**
 * Install (unzip) built-in extensions that are stored in /extensions to the
 * given target directory
 * 
 * @param {string} targetDir, the target directory to install extensions to 
 * @param {string} extensionsDir, the directory where the extension zips are located before being installed
 *                                defaults to defaultExtensionsDir variable
 */
async function installBuiltInExtensions(targetDir, extensionsDir = defaultExtensionsDir) {

  // get the zips from the /extensions directory
  const entries = await fs.readdir(extensionsDir, { withFileTypes: true });
  await Promise.all(entries.map(entry => {
    return installBuiltInExtension(entry, targetDir, extensionsDir);
  }));
}

/**
 * Install (unzip) a single built-in extension to a target directory
 * 
 * @param {string} file, the file to unzip
 * @param {string} targetDir, the target directory to install extensions to 
 * @param {string} extensionsDir, the directory where the extension zips are located before being installed
 *                                defaults to defaultExtensionsDir variable
 */
async function installBuiltInExtension(file, targetDir, extensionsDir) {
  let match;

  // look for files with names matching the expected pattern
  if (file.isFile() && (match = extensionsPattern.exec(file.name))) {
    const name = match[1];
    const version = match[2];

    if ((name == odoExtensionName) && (process.env.ON_OPENSHIFT != 'true')) {
      return;
    }

    const source = path.join(extensionsDir, file.name);
    const target = path.join(targetDir, name);
    const targetWithVersion = target + '-' + version;

    try {
      if (await prepForUnzip(target, version)) {
        const unzipCmd = `unzip ${source} -d ${targetDir}`;
        log.trace(`unzip command ${unzipCmd}`);
        await exec(unzipCmd);

        // top-level directory in zip will have the version suffix
        // rename to remove the version
        await fs.rename(targetWithVersion, target);
      }
    }
    catch (err) {
      log.warn(`Failed to install ${file.name}`);
      log.warn(err);
    }
    finally {
      // to be safe, try to remove directory with version name if it still exist
      await utils.forceRemove(targetWithVersion);
    }
  }
}

/**
 * Get the version of the given target extension.
 * 
 * @param {string} target extension location
 * @returns A version string, such as 0.0.1
 */
async function getVersion(target) {
  try {
    const codewindYamlPath = path.join(target, 'codewind.yaml');
    const codewindYamlContents = await fs.readFile(codewindYamlPath);
    const { version } = yaml.safeLoad(codewindYamlContents);
    const versionIsValid = versionPattern.test(version);
    if (versionIsValid) return version;
  }
  catch (err) {
    log.warn(err.message);
  }
  // couldn't figure out, return a default
  return '0.0.0';
}
  
/**
 * Performs a version check, returns true if version is newer than existingVersion.
 * 
 * @param {string} version The version to check
 * @param {string} existingVersion The existing version
 * @returns True if version is newer than existingVersion
 */
function isNewer(version, existingVersion) {

  const versions = version.split('.', 3);
  const existingVersions = existingVersion.split('.', 3);
  
  for (let i = 0; i < 3; i++) {
  
    const v = parseInt(versions[i]);
    const e = parseInt(existingVersions[i]);

    if (v != e)
      return v > e;
  }

  return false;
}
  
/**
 * Prepare the directory where an extension will be unzipped to. If directory
 * exists with the same name, it will be renamed by appending the SUFFIX_OLD variable to it.
 * 
 * @param {string} target, the target directory to unzip to
 * @param {string} version, the version we are trying to unzip
 * @returns True if the install should proceed, false otherwise
 */
async function prepForUnzip(target, version) {
  const fileExists = await fs.pathExists(target);
  if (fileExists) {
    const existingVersion = await getVersion(target);
    const newVersionIsNewer = isNewer(version, existingVersion);
    if (!newVersionIsNewer)
      return false;

    const targetOld = target + SUFFIX_OLD;

    // try to remove previous backup that may or may not exist before rename
    await utils.forceRemove(targetOld);
    await fs.rename(target, targetOld);
  }
  return true;
}

module.exports = {
  SUFFIX_OLD,
  installBuiltInExtensions,
}
