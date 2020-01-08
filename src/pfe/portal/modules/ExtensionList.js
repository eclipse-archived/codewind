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
const log = new Logger(__filename);

const { SUFFIX_OLD } = require('./utils/installExtensions');

/**
 * The ExtensionList class
 */
module.exports = class ExtensionList {
  constructor() {
    this._list = {};
  }

  /**
   * Function to load all extensions found in the extensions directory
   * @param extensionsPath, directory path of the extensions directory
   * @param templates, reference to the templates registry
   */
  async initialise(extensionsPath, templates) {
    try {
      log.trace(`loading extensions from disk, path: ${extensionsPath}`);
      const extensions = await this.loadExtensionsFromDisk(extensionsPath);
      log.trace(`adding extensions to the templates, path: ${extensionsPath}`);
      await addExtensionsToTemplates(extensions, templates);
    } catch(err) {
      log.error('Error loading codewind extension:');
      log.error(err);
      throw new ExtensionListError('FAILED_TO_LOAD');
    }
  }

  /**
   * Function to load an extension that exists in the extensions directory
   * @param extensionsPath, directory path of the extensions directory
   * @param name, name of the extension and its directory
   * @return Extension or null if the Extension could not be initialised
   */
  async loadExtensionFromDisk(extensionsPath, name) {
    try {
      let fstats = await fs.lstat(path.join(extensionsPath, name));
      // Extensions are in sub-directories of the top-level extensions directory
      if (fstats.isDirectory() && !name.endsWith(SUFFIX_OLD)) {
        const extension = new Extension({ path: path.join(extensionsPath, name), name });
        await extension.initialise();
        this.add(extension);
        log.info(`Extension ${name} successfully initialised`)
        return extension;
      }
    } catch (error) {
      log.warn(error);
      // ignore so that we can try to add other extensions
    }
    return null;
  }

  /**
   * Function to load an extension that exists in the extensions directory
   * @param extensionsPath, directory path of the extensions directory
   * @return extensions
   */
  async loadExtensionsFromDisk(extensionsPath) {
    const entries = await fs.readdir(extensionsPath);
    log.trace(`Extension Path: ${extensionsPath}, directory contents: ${entries}`);
    const returnedObjects = await Promise.all(entries.map(entry => this.loadExtensionFromDisk(extensionsPath, entry)));
    const extensions = returnedObjects.filter(Boolean);
    log.trace(`Extension Path: ${extensionsPath}, filtered returned extensions: ${extensions.map(ext=>ext.name).join(",\n\t")}`);
    return extensions;
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
      throw new ExtensionListError('NOT_FOUND', name);
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
 * Function to load an extension that exists in the extensions directory
 * @param extensions, a list of extensions
 * @param templates, reference to the templates registry
 * @return Promise
 */
function addExtensionsToTemplates(extensions, templates) {
  return Promise.all(extensions.map(async extension => {
    try {
      if (extension.templates) {
        log.trace(`Adding Extension ${extension.name}'s repository into the templates`);
        await templates.addRepository(extension.templates, extension.description);
      } else if (extension.templatesProvider) {
        log.trace(`Adding Extension ${extension.name}'s provider into the templates`);
        templates.addProvider(extension.name, extension.templatesProvider);
        delete extension.templatesProvider;
      }
    } catch (error) {
      log.warn(error);
    }
  }));
}
