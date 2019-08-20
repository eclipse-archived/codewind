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
const yaml = require('js-yaml');

const Logger = require('./utils/Logger');
const log = new Logger(__filename);

/**
 * The Extension class. Holds the metadata for a Codewind extension. Extensions are
 * located in sub-directories (one per extension) in the workspace .extensions
 * directory. The sub-directory contains scripts and executables required by the
 * extension, and a codewind.yaml file, e.g.:
 * 
 * name: myExtension
 * version: 1.0.0
 * description: This is an example of a codewind extension
 * projectType: myCustomType
 * commands:
 *   - name: build
 *     command: docker build
 *   - name: run
 *    command: docker run
 * detection: my_config.yaml
 * templates: https://raw.githubusercontent.com/repo/index.json
 */
module.exports = class Extension {

  /**
   * Constructor
   * @param path, codewind extension directory full path
   */
  constructor(args) {
    this.name = args.name;
    this.path = args.path;

    this.version = null;
    this.description = null;
    this.projectType = null;
    this.commands = [];
    this.detection = null;
    this.templates = null;
    this.config = {};
  }

  /**
   * Function to initialise an extension
   */
  async initialise() {
    try {
      // Load the extension definition file
      let definitionFile = await fs.readFile(path.join(this.path, 'codewind.yaml'));
      let definition = yaml.safeLoad(definitionFile);

      if (definition.hasOwnProperty('name')) {
        // TODO: validate extension name
        this.name = definition.name;
      }
      if (definition.hasOwnProperty('version')) {
        // TODO: validate extension version
        this.version = definition.version;
      }
      if (definition.hasOwnProperty('description')) {
        // TODO: validate extension description
        this.description = definition.description;
      }
      if (definition.hasOwnProperty('projectType')) {
        // TODO: validate extension project type
        this.projectType = definition.projectType;
      }
      if (definition.hasOwnProperty('commands')) {
        // TODO: validate extension commands (NB commands supported if project Type is "custom"
        this.commands = definition.commands;
      }
      if (definition.hasOwnProperty('detection')) {
        // TODO: validate extension detection
        this.detection = definition.detection;
      }
      if (definition.hasOwnProperty('templates')) {
        // TODO: validate extension templates/devfiles URL
        this.templates = definition.templates;
      }
      else {
        const providerPath = path.join(this.path, 'templatesProvider.js');
        if (await fs.exists(providerPath))
          this.templatesProvider = require(providerPath);
      }
      if (definition.hasOwnProperty('config')) {
        // TODO: validate extension configuration
        this.config = definition.config;
      }
    } catch (err) {
      log.error(`Error initialising extension ${this.name}`);
      throw(err);
    }
  }
}
