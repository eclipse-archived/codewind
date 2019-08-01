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

const Logger = require('./utils/Logger');
const log = new Logger('Templates.js');
const cwUtils = require('../modules/utils/sharedFunctions.js');

const DEFAULT_REPOSITORY_LIST = [
  {
    url: 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/master/devfiles/index.json',
    description: 'Standard Codewind templates.'
  }
];
module.exports = class Templates {

  constructor(workspace) {
    // If this exists it overrides the contents of DEFAULT_REPOSITORY_LIST
    this.projectTemplates = [];
    this.needsRefresh = true;
    this.repositoryFile = path.join(workspace, '.config/repository_list.json');
    this.repositoryList = DEFAULT_REPOSITORY_LIST;
    this.providers = {};
  }

  async initializeRepositoryList() {
    try {
      if (await cwUtils.fileExists(this.repositoryFile)) {
        let list = await fs.readJson(this.repositoryFile);
        this.repositoryList = list;
        this.needsRefresh = true;
      } else {
        // Save the default list to disk so the user can potentially edit it.
        this.writeRepositoryList();
      }
    } catch (err) {
      log.error(`Error reading repository list from ${this.repositoryFile}: ${err}`)
    }
  }

  async getTemplateList() {
    if (!this.needsRefresh) {
      return this.projectTemplates;
    }

    let newProjectTemplates = [];
    await Promise.all(this.repositoryList.map(async function getTemplates(repository) {

      let repositoryUrl = new URL(repository.url);

      let options = {
        host: repositoryUrl.host,
        path: repositoryUrl.pathname,
        method: 'GET',
      }

      try {
        let response = await cwUtils.asyncHttpRequest(options, undefined, repositoryUrl.protocol == 'https:');
        if (response.statusCode == 200) {

          const newTypes = JSON.parse(response.body);

          for (let i = 0; i < newTypes.length; i++) {

            newProjectTemplates.push({
              label: newTypes[i].displayName,
              description: newTypes[i].description,
              language: newTypes[i].language,
              url: newTypes[i].location,
              projectType: newTypes[i].projectType
            });
          }
        } else {
          // Treat this as an error and pass to our logging code below.
          throw new Error(`Unexpected http status for ${repository}: ${response.statusCode}`);
        }
      } catch (err) {
        // Log this but take no action as other repositories may work.
        log.warn(`Error accessing template repository: ${repository}`);
        log.warn(err);
      }
    }));

    // query providers
    for (let provider of Object.values(this.providers)) {
      try {
        const templates = await provider.getTemplates();
        newProjectTemplates.push(...templates);
      }
      catch (err) {
        log.error(err.message);
      }
    }

    newProjectTemplates.sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
    this.projectTemplates = newProjectTemplates;
    return this.projectTemplates;
  }

  async getTemplatesOfStyle(projectStyle) {
    const allTemplates = await this.getTemplateList();
    const relevantTemplates = allTemplates.filter(template =>
      getTemplateStyle(template) === projectStyle
    );
    return relevantTemplates;
  }

  writeRepositoryList() {
    // Use a callback here so we don't block the response to the request.
    fs.writeJson(this.repositoryFile, this.repositoryList, { spaces: '  ' }, err => {
      if (err) {
        log.error(`Error writing repository list to ${this.repositoryFile}: ${err}`)
      }
      log.info(`Repository list updated.`);
    });
  }

  getRepositories() {
    return this.repositoryList;
  }

  /**
   * Add a repository to the list of template repositories.
   *
   * @param {*} url - url of the template repository
   * @param {*} description - description of the template repository
   */
  addRepository(repositoryUrl, repositoryDescription) {
    if (this.getRepositories().filter(repo => repo.url == repositoryUrl).length != 0) {
      return false;
    }
    const newRepo = {
      url: repositoryUrl,
      description: repositoryDescription,
    }
    this.repositoryList.push(newRepo);
    this.needsRefresh = true;
    this.writeRepositoryList();
    return true;
  }

  deleteRepository(repositoryUrl) {
    this.repositoryList = this.repositoryList.filter((repo) => repo.url != repositoryUrl);
    this.needsRefresh = true;
    this.writeRepositoryList();
  }

  addProvider(name, provider) {
    this.providers[name] = provider;
  }

  async getTemplateStyles() {
    const templates = await this.getTemplateList();
    const styles = templates.map(template => getTemplateStyle(template));
    const uniqueStyles = [...new Set(styles)];
    return uniqueStyles;
  }
}

function getTemplateStyle(template) {
  // if a project's style isn't specified, it defaults to 'Codewind'
  return template.projectStyle || 'Codewind';
}
