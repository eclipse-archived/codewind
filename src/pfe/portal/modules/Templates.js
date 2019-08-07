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
    description: 'Standard Codewind templates.',
    enabled: true,
  },
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
        await this.writeRepositoryList();
      }
    } catch (err) {
      log.error(`Error reading repository list from ${this.repositoryFile}: ${err}`)
    }
  }
  async getTemplates({ projectStyle, showEnabledOnly }) {
    let templates = (showEnabledOnly === 'true')
      ? await this.getEnabledTemplates()
      : await this.getAllTemplates();

    if (projectStyle) {
      templates = filterTemplatesByStyle(templates, projectStyle);
    }
    return templates;
  }

  getEnabledTemplates() {
    return this.getTemplateList(this.getEnabledRepositories());
  }

  getAllTemplates() {
    return this.getTemplateList(this.repositoryList);
  }

  async getTemplateList(repositoryList) {
    if (!this.needsRefresh) {
      return this.projectTemplates;
    }

    let newProjectTemplates = [];

    // apply reduce function to create a copy of the repository list index by url
    const repos = repositoryList.reduce(reducer, {});

    // query providers for more repositories
    for (let provider of Object.values(this.providers)) {
      try {
        const extraRepos = await provider.getRepositories();
        if (Array.isArray(extraRepos))
          // apply reduce function here again, urls that we already have are ignored
          extraRepos.reduce(reducer, repos);
      }
      catch (err) {
        log.error(err.message);
      }
    }

    await Promise.all(Object.values(repos).map(async function getTemplatesFromRepo(repository) {

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

    newProjectTemplates.sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
    this.projectTemplates = newProjectTemplates;
    return this.projectTemplates;
  }

  // Save the default list to disk so the user can potentially edit it (WHEN CODEWIND IS NOT RUNNING)
  async writeRepositoryList() {
    try {
      await fs.writeJson(this.repositoryFile, this.repositoryList, { spaces: '  ' });
      log.info(`Repository list updated.`);
    } catch (err) {
      log.error(`Error writing repository list to ${this.repositoryFile}: ${err}`)
    }
  }

  getRepositories() {
    return this.repositoryList;
  }

  getEnabledRepositories() {
    return this.getRepositories().filter(repo =>
      // if the repo doesn't specify whether it's enabled, consider it enabled
      (repo.enabled || !repo.hasOwnProperty('enabled'))
    );
  }

  doesRepositoryExist(repoUrl) {
    try {
      this.getRepository(repoUrl);
      return true;
    } catch (error) {
      return false;
    }
  }

  getRepositoryIndex(url) {
    const repos = this.getRepositories();
    const index = repos.findIndex(repo => repo.url === url);
    return index;
  }

  /**
   * @param {String} url
   * @return {JSON} reference to the repo object in this.repositoryList
   */
  getRepository(url) {
    const index = this.getRepositoryIndex(url);
    if (index < 0) throw new Error(`no repository found with URL '${url}'`);
    const repo = this.getRepositories()[index];
    return repo;
  }

  async enableRepository(url) {
    const repo = this.getRepository(url);
    repo.enabled = true;
    await this.writeRepositoryList();

  }

  async disableRepository(url) {
    const repo = this.getRepository(url);
    repo.enabled = false;
    await this.writeRepositoryList();
  }

  async performOperation(operation) {
    const { op, path, value } = operation;
    let operationResult = {};
    if (op === 'enable') {
      operationResult = await this.performEnableOrDisableOperation({ path, value });
    }
    operationResult.requestedOperation = operation;
    return operationResult;
  }

  /**
   *
   * @returns {JSON} { status, error (optional) }
   */
  async performEnableOrDisableOperation({ path, value }) {
    const repoUrl = path;
    if (!this.doesRepositoryExist(repoUrl)) {
      return {
        status: 404,
        error: 'Unknown repository URL',
      };
    }
    try {
      if (value === 'true') {
        await this.enableRepository(repoUrl);
      } else {
        await this.disableRepository(repoUrl);
      }
      return {
        status: 200
      };
    } catch (error) {
      return {
        status: 500,
        error: error.message,
      };
    }
  }

  /**
   * Add a repository to the list of template repositories.
   *
   * @param {*} url - url of the template repository
   * @param {*} description - description of the template repository
   */
  async addRepository(repositoryUrl, repositoryDescription) {
    if (this.getRepositories().find(repo => repo.url == repositoryUrl)) {
      throw new Error('Repository URL must be unique');
    }
    const newRepo = {
      url: repositoryUrl,
      description: repositoryDescription,
    }
    this.repositoryList.push(newRepo);
    this.needsRefresh = true;
    await this.writeRepositoryList();
  }

  async deleteRepository(repositoryUrl) {
    this.repositoryList = this.repositoryList.filter((repo) => repo.url != repositoryUrl);
    this.needsRefresh = true;
    await this.writeRepositoryList();
  }

  addProvider(name, provider) {
    if (provider && typeof provider.getRepositories == 'function')
      this.providers[name] = provider;
  }

  async getTemplateStyles() {
    const templates = await this.getAllTemplates();
    const styles = templates.map(template => getTemplateStyle(template));
    const uniqueStyles = [...new Set(styles)];
    return uniqueStyles;
  }
}

function filterTemplatesByStyle(templates, projectStyle) {
  const relevantTemplates = templates.filter(template =>
    getTemplateStyle(template) === projectStyle
  );
  return relevantTemplates;
}

function getTemplateStyle(template) {
  // if a project's style isn't specified, it defaults to 'Codewind'
  return template.projectStyle || 'Codewind';
}

// reduce function, want to take repository list and index
// them by url, and use that to avoid processing duplicate entries
function reducer(repos, repo) {
  if (repo.url && !repos[repo.url])
    repos[repo.url] = repo;
  return repos;
}
module.exports.filterTemplatesByStyle =  filterTemplatesByStyle;
