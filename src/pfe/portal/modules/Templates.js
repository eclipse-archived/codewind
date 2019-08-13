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

const cwUtils = require('../modules/utils/sharedFunctions');
const Logger = require('./utils/Logger');
const TemplateError = require('./utils/errors/TemplateError');

const log = new Logger('Templates.js');

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
    return this.getTemplatesFromRepos(this.getEnabledRepositories());
  }

  getAllTemplates() {
    if (!this.needsRefresh) {
      return this.projectTemplates;
    }
    return this.getTemplatesFromRepos(this.repositoryList);
  }

  async getTemplatesFromRepos(repositoryList) {
    const providers = Object.values(this.providers);
    const providedRepos = await getReposFromProviders(providers);
    // Avoid processing duplicate repos
    const extraRepos = providedRepos.filter(repo =>
      !repositoryList.find(repo2 => repo2.url === repo.url)
    );
    const repos = repositoryList.concat(extraRepos);

    let newProjectTemplates = [];
    await Promise.all(repos.map(async(repo) => {
      try {
        const extraTemplates = await getTemplatesFromRepo(repo);
        newProjectTemplates = newProjectTemplates.concat(extraTemplates);
      } catch (err) {
        log.warn(`Error accessing template repository '${repo.url}'. Error: ${util.inspect(err)}`);
        // Ignore to keep trying other repositories
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
    await fs.writeJson(this.repositoryFile, this.repositoryList, { spaces: '  ' });
    log.info(`Repository list updated.`);
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

  enableRepository(url) {
    const repo = this.getRepository(url);
    repo.enabled = true;
  }

  disableRepository(url) {
    const repo = this.getRepository(url);
    repo.enabled = false;
  }

  async batchUpdate(requestedOperations) {
    const operationResults = requestedOperations.map(operation => this.performOperation(operation));
    await this.writeRepositoryList();
    return operationResults;
  }

  performOperation(operation) {
    const { op, url, value } = operation;
    let operationResult = {};
    if (op === 'enable') {
      operationResult = this.performEnableOrDisableOperation({ url, value });
    }
    operationResult.requestedOperation = operation;
    return operationResult;
  }

  /**
   * @param {JSON} { url (URL of template repo to enable or disable), value (true|false)}
   * @returns {JSON} { status, error (optional) }
   */
  performEnableOrDisableOperation({ url, value }) {
    if (!this.doesRepositoryExist(url)) {
      return {
        status: 404,
        error: 'Unknown repository URL',
      };
    }
    try {
      if (value === 'true') {
        this.enableRepository(url);
      } else {
        this.disableRepository(url);
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
   */
  async addRepository(repoUrl, repoDescription) {
    if (this.getRepositories().find(repo => repo.url == repoUrl)) {
      throw new TemplateError('DUPLICATE_URL', repoUrl);
    }
    const newRepo = {
      url: repoUrl,
      description: repoDescription,
    }
    this.repositoryList.push(newRepo);
    this.needsRefresh = true;
    await this.writeRepositoryList();
  }

  async deleteRepository(repoUrl) {
    this.repositoryList = this.repositoryList.filter((repo) => repo.url != repoUrl);
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

async function getTemplatesFromRepo(repository) {
  if (!repository.url) {
    throw new Error(`repo '${repository}' must have a URL`);
  }
  const repoUrl = new URL(repository.url);

  const options = {
    host: repoUrl.host,
    path: repoUrl.pathname,
    method: 'GET',
  }
  const res = await cwUtils.asyncHttpRequest(options, undefined, repoUrl.protocol === 'https:');
  if (res.statusCode !== 200) {
    throw new Error(`Unexpected HTTP status for ${repository}: ${res.statusCode}`);
  }

  let templateSummaries;
  try {
    templateSummaries = JSON.parse(res.body);
  } catch (error) {
    throw new Error(`URL '${repoUrl}' should return JSON`);
  }
  const templates = templateSummaries.map(summary => {
    return {
      label: summary.displayName,
      description: summary.description,
      language: summary.language,
      url: summary.location,
      projectType: summary.projectType
    };
  });
  return templates;
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

async function getReposFromProviders(providers) {
  const repos = [];
  await Promise.all(providers.map(async(provider) => {
    try {
      const providedRepos = await provider.getRepositories();
      if (!Array.isArray(providedRepos)) {
        throw new Error (`provider ${util.inspect(provider)} should provide an array of repos, but instead provided '${providedRepos}'`);
      }
      providedRepos.forEach(repo => {
        if (isRepo(repo)) {
          repos.push(repo);
        }
      })
    }
    catch (err) {
      log.error(err.message);
    }
  }));
  return repos;
}

function isRepo(obj) {
  return obj.hasOwnProperty('url');
}

module.exports.getTemplatesFromRepo = getTemplatesFromRepo;
module.exports.filterTemplatesByStyle = filterTemplatesByStyle;
module.exports.getReposFromProviders = getReposFromProviders;
