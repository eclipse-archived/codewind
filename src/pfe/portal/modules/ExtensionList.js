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
const Extension = require('./Extension.js');
const Logger = require('./utils/Logger');
const ExtensionListError = require('./utils/errors/ExtensionListError');
const utils = require('./utils/sharedFunctions');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const log = new Logger(__filename);

const extensionsDir = '/extensions';
const extensionsPattern = /^(\S+)-(\d+\.\d+\.\d+)\.zip$/; // e.g. extension-name-0.0.1.zip
const suffixOld = '__old';
const odoExtensionName = "codewind-odo-extension";
const odoBinarySource = "https://mirror.openshift.com/pub/openshift-v4/clients/odo/latest/odo-linux-amd64"

/**
 * The ExtensionList class
 */
module.exports = class ExtensionList {
  constructor() {
    this._list = {};
  }
  
  /**
   * Install (unzip) built-in extensions that are stored in /extensions to the
   * given target directory
   * 
   * @param {string} targetDir, the target directory to install extensions to 
   */
  async installBuiltInExtensions(targetDir) {
  
    // get the zips from the /extensions directory
    const entries = await fs.readdir(extensionsDir, { withFileTypes: true });
    
    for (let entry of entries) {
      
        let match;
  
        // look for files with names matching the expected pattern
        if (entry.isFile() && (match = extensionsPattern.exec(entry.name))) {
          
          const name = match[1];
          const version = match[2];

          if ((name == odoExtensionName) && (process.env.ON_OPENSHIFT != 'true')) {
            continue;
          }

          const source = path.join(extensionsDir, entry.name);
          const target = path.join(targetDir, name);
          const targetWithVersion = target + '-' + version;

          try {
            if (await prepForUnzip(target, version)) {
              await exec(`unzip ${source} -d ${targetDir}`);
              
              if (name == odoExtensionName) {
                await exec(`mkdir -p ${targetWithVersion}/bin`);
                await exec(`curl -L ${odoBinarySource} -o ${targetWithVersion}/bin/odo && chmod +x ${targetWithVersion}/bin/odo`);
              }

              // top-level directory in zip will have the version suffix
              // rename to remove the version
              await fs.rename(targetWithVersion, target);
            }
          }
          catch (err) {
            log.warn(`Failed to install ${entry.name}`);
            log.warn(err);
          }
          finally {
            // to be safe, try to remove directory with version name if it still exist
            await forceRemove(targetWithVersion);
          }
        }
    }
  }

  /**
   * Function to load all extensions found in the extensions directory
   * @param extensionsPath, directory path of the extensions directory
   * @param templates, reference to the templates registry
   */
  async initialise(extensionsPath, templates) {
    try {
      // Read the extensions directory, create and add extensions to the list
      let entries = await fs.readdir(extensionsPath);
      for (const entry of entries) {
        try {
          let fstats = await fs.lstat(path.join(extensionsPath, entry));
          // Extensions are in sub-directories of the top-level extensions directory
          if (fstats.isDirectory() && !entry.endsWith(suffixOld)) {
            const extension = new Extension({path: path.join(extensionsPath, entry), name: entry});
            await extension.initialise();
            this.add(extension);
            if (extension.templates) {
              await templates.addRepository(extension.templates, extension.description);
            } else if (extension.templatesProvider) {
              templates.addProvider(extension.name, extension.templatesProvider);
              delete extension.templatesProvider;
            }
          }
        } catch (error) {
          log.warn(error);
          // ignore so that we can try to add other repos in the list
        }
      }
    } catch(err) {
      log.error('Error loading codewind extension:');
      log.error(err);
      throw new ExtensionListError('FAILED_TO_LOAD');
    }
  }

  /**
   * Function to add an extension to the list
   * Throws an error if the extension already exists
   * @param extension, the extension to add to the list
   */
  add(extension) {
    if (this._list.hasOwnProperty(extension.name)) {
      throw new ExtensionListError('EXISTS', extension.name);
    } else {
      this._list[extension.name] = extension;
    }
  }

  /**
   * Function to remove an extension from the list
   * Throws an error if the extension was not found in the list
   * @param name, the name of the extension to remove from the list
   */
  remove(name) {
    if (!this._list.hasOwnProperty(name)) {
      throw new ExtensionListError('NOT_FOUND',name);
    } else {
      delete this._list[name];
    }
  }

  /**
   * Function to retrieve an extension from the list
   * Throws an error if the extension was not found in the list
   * @param name, the name of the extension
   * @return the requested extension
   */
  retrieve(name) {
    if (this._list.hasOwnProperty(name)) {
      return this._list[name];
    }
    return undefined;
  }

  /**
   * Function to get all the extension names as an array
   * @return array of extension names
   */
  getNames() {
    let array = [];
    for (let key in this._list) {
      array.push(key);
    }
    return array;
  }

  /**
   * Function to get all extension project types as an array
   * @return array of project types
   */
  getProjectTypes() {
    let array = [];
    for (let key in this._list) {
      if (this._list[key].projectType != null) {
        array.push(this._list[key].projectType);
      }
    }
    return array;
  }

  /**
   * Function to get an extension given a project type
   * @return extension
   */
  getExtensionForProjectType(type) {
    for (let key in this._list) {
      if (this._list[key].projectType == type) {
        return this._list[key];
      }
    }
    return null;
  }

  /**
   * Function to get an array that maps extension types to detection filenames
   * @return array
   */
  getDetectionList() {
    let array = [];
    for (let key in this._list) {
      if (this._list[key].projectType && this._list[key].detection) {
        array.push({type: this._list[key].projectType, file: this._list[key].detection});
      }
    }
    return array;
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
    const result = await exec(`grep -P "^version: \\d+\\.\\d+\\.\\d+$" ${target}/codewind.yaml`);
    if (result.stdout)
      return result.stdout.substring(9).trimRight();
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
 * Force remove a path, regardless of whether it exists, or it's file or directory that may or may not be empty.
 * 
 * @param {string} path, path to remove
 */
async function forceRemove(path) {
  try {
    await exec(`rm -rf ${path}`);
  }
  catch (err) {
    log.warn(err.message);
  }
}

/**
 * Prepare the directory where an extension will be unzipped to. If directory
 * exists with the same name, it will be renamed by appending the "__old" suffix to it.
 * 
 * @param {string} target, the target directory to unzip to
 * @param {string} version, the version we are trying to unzip
 * @returns True if the install should proceed, false otherwise
 */
async function prepForUnzip(target, version) {
  
  if (await utils.fileExists(target)) {
  
    const existingVersion = await getVersion(target);

    if (!isNewer(version, existingVersion))
      return false;

    const targetOld = target + suffixOld;

    // try to remove previous backup that may or may not exist before rename
    await forceRemove(targetOld);
    await fs.rename(target, targetOld);
  }

  return true;
}
