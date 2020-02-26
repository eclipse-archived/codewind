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
const uuidv5 = require('uuid/v5');

const cwUtils = require('../modules/utils/sharedFunctions');
const Logger = require('./utils/Logger');
const TemplateError = require('./utils/errors/TemplateError');

const log = new Logger('Templates.js');

const CODEWIND_REPO = {
  url: 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/master/devfiles/index.json',
  description: 'Codewind project templates help you create containerized projects for various runtimes.',
  enabled: true,
  protected: true,
  projectStyles: ['Codewind'],
  name: 'Default templates',
};

const kabaneroDescription = 'Kabanero, an open source project, brings together open source technologies into a microservices-based framework. ' +
'Kabanero builds cloud native applications ready for deployment onto Kubernetes and Knative.'

const KABANERO_REPO = {
  url: 'https://github.com/kabanero-io/collections/releases/latest/download/kabanero-index.json',
  name: 'Kabanero Collections',
  description: kabaneroDescription,
  enabled: false,
  protected: true,
};

const DEFAULT_REPOSITORY_LIST = [
  CODEWIND_REPO, KABANERO_REPO,
];

module.exports = class Templates {
  constructor(workspace) {
    // If this exists it overrides the contents of DEFAULT_REPOSITORY_LIST
    // One list for enabled templates, another that includes the disabled templates.
    this.enabledProjectTemplates = [];
    this.allProjectTemplates = [];
    this.repositoryFile = path.join(workspace, '.config/repository_list.json');
    this.repositoryList = DEFAULT_REPOSITORY_LIST;
    this.providers = {};
    this.unlock();
  }

  async initializeRepositoryList() {
    this.lock();
    try {
      let repositories = [...this.repositoryList];
      const repositoryFileExists = await cwUtils.fileExists(this.repositoryFile);
      if (repositoryFileExists) {
        repositories = await fs.readJson(this.repositoryFile);
      }
      repositories = await updateRepoListWithReposFromProviders(this.providers, repositories, this.repositoryFile);
      repositories = await fetchAllRepositoryDetails(repositories);
      this.repositoryList = repositories;

      // Fetch templates
      const { enabledTemplates, allTemplates } = await fetchTemplates(this.repositoryList);
      this.enabledProjectTemplates = enabledTemplates;
      this.allProjectTemplates = allTemplates;

      await writeRepositoryList(this.repositoryFile, this.repositoryList);
    } catch (err) {
      log.error(`Error initializing repository list: ${err}`);
    } finally {
      this.unlock();
    }
  }

  lock() {
    if (this._lock === true) throw new TemplateError('LOCKED');
    this._lock = true;
  }

  unlock() {
    this._lock = false;
  }

  // TEMPLATES
  getTemplates(enabledOnly) {
    this.lock();
    try {
      return enabledOnly ? this.enabledProjectTemplates : this.allProjectTemplates;
    } finally {
      this.unlock();
    }
  }

  getTemplatesByStyle(projectStyle, enabledOnly = false) {
    this.lock();
    try {
      const templates = enabledOnly ? this.enabledProjectTemplates : this.allProjectTemplates;
      return filterTemplatesByStyle(templates, projectStyle);
    } finally {
      this.unlock();
    }
  }

  async getAllTemplateStyles() {
    this.lock();
    try {
      const templates = await this.allProjectTemplates;
      return getTemplateStyles(templates);
    } finally {
      this.unlock();
    }
  }

  // REPOSITORIES

  getRepositories() {
    this.lock();
    try {
      return this.repositoryList;
    } finally {
      this.unlock();
    }
  }

  /**
   * @param {String} url
   * @return {JSON} reference to the repo object in this.repositoryList
   */
  getRepository(url) {
    this.lock();
    try {
      const repo = this.repositoryList.find(repo => repo.url === url);
      if (!repo) return null;
      return repo;
    } finally {
      this.unlock();
    }
  }

  /**
   * Add a repository to the list of template repositories.
   */
  async addRepository(repoUrl, repoDescription, repoName, isRepoProtected) {
    this.lock();
    try {
      const repositories = [...this.repositoryList];
      const validatedUrl = await validateRepository(repoUrl, repositories);
      const newRepo = await constructRepositoryObject(validatedUrl, repoDescription, repoName, isRepoProtected);

      await this.addRepositoryToProviders(newRepo);

      // Only update the repositoryList if the providers can be updated
      const newRepositoryList = [...this.repositoryList, newRepo];
      this.repositoryList = await updateRepoListWithReposFromProviders(this.providers, newRepositoryList, this.repositoryFile);

      // Fetch templates from the new repository and add them
      const newTemplates = await getTemplatesFromRepo(newRepo)
      this.enabledProjectTemplates = this.allProjectTemplates.concat(newTemplates);
      this.allProjectTemplates = this.allProjectTemplates.concat(newTemplates);

      await writeRepositoryList(this.repositoryFile, this.repositoryList);
    } finally {
      this.unlock();
    }
  }

  async deleteRepository(repoUrl) {
    this.lock();
    try {
      const repoToDelete = this.repositoryList.find(repo => repo.url === repoUrl);
      if (!repoToDelete) throw new TemplateError('REPOSITORY_DOES_NOT_EXIST', repoUrl);
      await this.removeRepositoryFromProviders(repoToDelete);
      try {
        const currentRepoList = [...this.repositoryList];
        const updatedRepoList = await updateRepoListWithReposFromProviders(this.providers, currentRepoList, this.repositoryFile);
        this.repositoryList = updatedRepoList.filter(repo => repo.url !== repoUrl);
      }
      catch (err) {
        // rollback
        this.addRepositoryToProviders(repoToDelete).catch(error => log.warn(error.message));
        throw err;
      }
      // writeRepositoryList regardless of whether it has been updated with the data from providers
      await writeRepositoryList(this.repositoryFile, this.repositoryList);

      // If template has a sourceId then use sourceId and repo id otherwise use source and repo name
      const deleteTemplatesThatBelongToRepo = template => {
        return (template.sourceId) ? template.sourceId !== repoToDelete.id : template.source !== repoToDelete.name;
      }

      this.enabledProjectTemplates = this.enabledProjectTemplates.filter(deleteTemplatesThatBelongToRepo);
      this.allProjectTemplates = this.allProjectTemplates.filter(deleteTemplatesThatBelongToRepo);
    } finally {
      this.unlock();
    }
  }

  async batchUpdate(requestedOperations) {
    this.lock();
    try {
      const promiseList = requestedOperations.map(operation => this.performOperationOnRepository(operation));
      const operationResults = await Promise.all(promiseList);
      await writeRepositoryList(this.repositoryFile, this.repositoryList);
      return operationResults;
    } finally {
      this.unlock();
    }
  }

  async performOperationOnRepository(operation) {
    const { op, url, value } = operation;
    let operationResult = {};
    if (op === 'enable') {
      operationResult = await this.enableOrDisableRepository({ url, value });
    }
    operationResult.requestedOperation = operation;
    return operationResult;
  }

  /**
   * @param {JSON} { url (URL of template repo to enable or disable), value (true|false)}
   * @returns {JSON} { status, error (optional) }
   */
  async enableOrDisableRepository({ url, value }) {
    if (!this.getRepository(url)) {
      return {
        status: 404,
        error: 'Unknown repository URL',
      };
    }
    try {
      const repo = await this.getRepository(url);
      repo.enabled = (value === 'true' || value === true);
      const { enabledTemplates, allTemplates } = await fetchTemplates(this.repositoryList);
      this.enabledProjectTemplates = enabledTemplates;
      this.allProjectTemplates = allTemplates;
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

  // PROVIDERS
  async addProvider(name, provider) {
    this.lock();
    try {
      if (provider && typeof provider.getRepositories === 'function') {
        this.providers[name] = provider;
        const currentRepoList = [...this.repositoryList];
        this.repositoryList = await updateRepoListWithReposFromProviders([provider], currentRepoList, this.repositoryFile);

        // Fetch templates from the new repository and add them
        const { enabledTemplates, allTemplates } = await fetchTemplates(this.repositoryList);
        this.enabledProjectTemplates = enabledTemplates;
        this.allProjectTemplates = allTemplates;

        await writeRepositoryList(this.repositoryFile, this.repositoryList);
      }
    } finally {
      this.unlock();
    }
  }

  async addRepositoryToProviders(repo) {
    const promises = [];
    for (const provider of Object.values(this.providers)) {
      if (typeof provider.canHandle === 'function') {
        // make a new copy to for each provider to be invoked with
        // in case any provider modifies it (which they shouldn't do)
        const copy = Object.assign({}, repo);
        if (provider.canHandle(copy) && typeof provider.addRepository === 'function') {
          promises.push(provider.addRepository(copy));
        }
      }
    }

    try {
      await Promise.all(promises);
    }
    catch (err) {
      throw new TemplateError('ADD_TO_PROVIDER_FAILURE', repo.url, err.message);
    }
  }

  removeRepositoryFromProviders(repo) {
    const promises = [];
    for (const provider of Object.values(this.providers)) {
      if (typeof provider.canHandle === 'function') {
        // make a new copy to for each provider to be invoked with
        // in case any provider modifies it (which they shouldn't do)
        const copy = Object.assign({}, repo);
        if (provider.canHandle(copy) && typeof provider.removeRepository === 'function')
          promises.push(provider.removeRepository(copy));
      }
    }
    return Promise.all(promises);
  }
}

// FUNCTIONS

// Save the default list to disk so the user can potentially edit it (WHEN CODEWIND IS NOT RUNNING)
async function writeRepositoryList(repositoryFile, repositoryList) {
  await fs.ensureFile(repositoryFile);
  await fs.writeJson(repositoryFile, repositoryList, { spaces: '  ' });
  log.info(`Repository list updated.`);
}

async function validateRepository(repoUrl, repositories) {
  let url;
  try {
    url = new URL(repoUrl).href;
  } catch (error) {
    if (error.message.includes('Invalid URL')) {
      throw new TemplateError('INVALID_URL', repoUrl);
    }
    throw error;
  }

  if (repositories.find(repo => repo.url === repoUrl)) {
    throw new TemplateError('DUPLICATE_URL', repoUrl);
  }

  const validJsonURL = await doesURLPointToIndexJSON(url);
  if (!validJsonURL) {
    throw new TemplateError('URL_DOES_NOT_POINT_TO_INDEX_JSON', url);
  }

  return url;
}

async function constructRepositoryObject(url, description, name, isRepoProtected) {
  let repository = {
    id: uuidv5(url, uuidv5.URL),
    name,
    url,
    description,
    enabled: true,
  }
  repository = await fetchRepositoryDetails(repository);
  if (isRepoProtected !== undefined) {
    repository.protected = isRepoProtected;
  }
  return repository;
}

function getRepositoryIndex(url, repositories) {
  const index = repositories.findIndex(repo => repo.url === url);
  return index;
}

async function updateRepoListWithReposFromProviders(providers, repositoryList) {
  const providedRepos = await getReposFromProviders(Object.values(providers));

  const extraRepos = providedRepos.filter(providedRepo =>
    !repositoryList.find(existingRepo => existingRepo.url === providedRepo.url)
  );
  if (extraRepos.length > 0) {
    const reposWithCodewindSettings = await addCodewindSettingsToRepository(extraRepos);
    const updatedRepositoryList = repositoryList.concat(reposWithCodewindSettings);
    return updatedRepositoryList;
  }
  return repositoryList;
}

function addCodewindSettingsToRepository(repos) {
  return Promise.all(
    repos.map(async repo => {
      repo.enabled = true;
      repo.protected = true;
      const repoWithTemplateStyles = await fetchRepositoryDetails(repo);
      return repoWithTemplateStyles;
    })
  );
}

function fetchAllRepositoryDetails(repos) {
  return Promise.all(
    repos.map(repo => fetchRepositoryDetails(repo))
  );
}

async function fetchRepositoryDetails(repo) {
  let newRepo = {...repo}

  // Only set the name or description of the repo if not given by the user
  if (!(repo.name && repo.description)){
    const repoDetails = await getNameAndDescriptionFromRepoTemplatesJSON(newRepo.url);
    newRepo = cwUtils.updateObject(newRepo, repoDetails);
  }

  if (repo.projectStyles) {
    return newRepo;
  }

  const templatesFromRepo = await getTemplatesFromRepo(repo);
  newRepo.projectStyles = getTemplateStyles(templatesFromRepo);
  return newRepo;
}

async function getNameAndDescriptionFromRepoTemplatesJSON(url) {
  if (!url) throw new Error(`must supply a URL`);

  const templatesUrl = new URL(url);
  // return repository untouched if repository url points to a local file
  if ( templatesUrl.protocol === 'file:' ) {
    return {};
  }
  const indexPath = templatesUrl.pathname;
  const templatesPath = path.dirname(indexPath) + '/' + 'templates.json';

  templatesUrl.pathname = templatesPath;

  const options = {
    host: templatesUrl.host,
    path: templatesUrl.pathname,
    method: 'GET',
  }

  const res = await cwUtils.asyncHttpRequest(options, undefined, templatesUrl.protocol === 'https:');
  if (res.statusCode !== 200) {
    return {};
  }

  try {
    const templateDetails = JSON.parse(res.body);
    const repositoryDetails = {};
    for (const prop of ['name', 'description']) {
      if (templateDetails.hasOwnProperty(prop)) {
        repositoryDetails[prop] = templateDetails[prop];
      }
    }
    return repositoryDetails;
  } catch (error) {
    // Log an error but don't throw an exception as this is optional.
    log.error(`URL '${templatesUrl}' should return JSON`);
  }
  return {};
}

async function fetchTemplates(repositories) {
  // const repositories = this.getRepositories();
  const enabledRepositories = repositories.filter(repo => repo.enabled);
  const disabledRepositories = repositories.filter(repo => !repo.enabled);
  const enabledTemplates = await getTemplatesFromRepos(enabledRepositories);
  const disabledTemplates = await getTemplatesFromRepos(disabledRepositories);
  // this.enabledProjectTemplates = newEnabledTemplates;
  const allTemplates = enabledTemplates.concat(disabledTemplates);
  return { enabledTemplates, allTemplates }
}

async function getTemplatesFromRepos(repos) {
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
  newProjectTemplates.sort((a, b) => a.label.localeCompare(b.label));
  return newProjectTemplates;
}

async function getTemplatesFromRepo(repository) {
  if (!repository.url) {
    throw new Error(`repo '${repository}' must have a URL`);
  }

  const templateSummaries = await getTemplatesJSONFromURL(repository.url);

  const templates = templateSummaries.map(summary => {
    const template = {
      label: summary.displayName,
      description: summary.description,
      language: summary.language,
      url: summary.location,
      projectType: summary.projectType,
    };

    if (summary.projectStyle) {
      template.projectStyle = summary.projectStyle;
    }
    if (repository.name) {
      template.source = repository.name;
    }
    if (repository.id) {
      template.sourceId = repository.id;
    }

    return template;
  });
  return templates;
}

async function getTemplatesJSONFromURL(givenURL) {
  const parsedURL = new URL(givenURL);
  let templateSummaries;
  // check if repository url points to a local file and read it accordingly
  if (parsedURL.protocol === 'file:') {
    try {
      if (await fs.pathExists(parsedURL.pathname) ) {
        templateSummaries = await fs.readJSON(parsedURL.pathname);
      }
    } catch (err) {
      throw new Error(`repo file '${parsedURL}' did not return JSON`);
    }
  } else {
    const options = {
      host: parsedURL.host,
      path: parsedURL.pathname,
      method: 'GET',
    }
    const res = await cwUtils.asyncHttpRequest(options, undefined, parsedURL.protocol === 'https:');
    if (res.statusCode !== 200) {
      throw new Error(`Unexpected HTTP status for ${givenURL}: ${res.statusCode}`);
    }
    try {
      templateSummaries = JSON.parse(res.body);
    } catch (error) {
      // TODO add TemplateError here
      throw new Error(`URL '${parsedURL}' did not return JSON`);
    }
  }
  return templateSummaries;
}

function filterTemplatesByStyle(templates, projectStyle) {
  const relevantTemplates = templates.filter(template =>
    getTemplateStyle(template) === projectStyle
  );
  return relevantTemplates;
}

function getTemplateStyles(templates) {
  const styles = templates.map(template => getTemplateStyle(template));
  const uniqueStyles = [...new Set(styles)];
  return uniqueStyles;
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
  return Boolean((obj && obj.hasOwnProperty('url')));
}

async function doesURLPointToIndexJSON(inputUrl) {
  try {
    const templateSummaries = await getTemplatesJSONFromURL(inputUrl);
    if (templateSummaries.some(summary => !isTemplateSummary(summary))) {
      return false;
    }
  } catch(error) {
    log.warn(error);
    return false
  }
  return true;
}

function isTemplateSummary(obj) {
  const expectedKeys = ['displayName', 'description', 'language', 'projectType', 'location', 'links'];
  return expectedKeys.every(key => obj.hasOwnProperty(key));
}
