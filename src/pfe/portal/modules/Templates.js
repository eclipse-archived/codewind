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
    this._lock = false;
  }

  async initializeRepositoryList() {
    this.lock();
    try {
      let repositories = cwUtils.deepClone(this.repositoryList);
      const repositoryFileExists = await cwUtils.fileExists(this.repositoryFile);
      if (repositoryFileExists) {
        repositories = await fs.readJson(this.repositoryFile);
      }
      repositories = await updateRepoListWithReposFromProviders(this.providers, repositories, this.repositoryFile);
      repositories = await fetchAllRepositoryDetails(repositories);
      this.repositoryList = repositories;

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
    if (this._lock === false) throw new TemplateError('NOT_LOCKED');
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
      return repo || null;
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
      const repositories = cwUtils.deepClone(this.repositoryList);
      const validatedUrl = await validateRepository(repoUrl, repositories);
      const newRepo = await constructRepositoryObject(validatedUrl, repoDescription, repoName, isRepoProtected);

      const providers = cwUtils.deepClone(this.providers);
      this.providers = await addRepositoryToProviders(newRepo, providers);

      // Only update the repositoryList if the providers can be updated
      const currentRepoList = cwUtils.deepClone(this.repositoryList);
      const newRepositoryList = [...currentRepoList, newRepo];
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
      const providers = cwUtils.deepClone(this.providers);
      this.providers = await removeRepositoryFromProviders(repoToDelete, providers);
      try {
        const currentRepoList = cwUtils.deepClone(this.repositoryList);
        const updatedRepoList = await updateRepoListWithReposFromProviders(this.providers, currentRepoList, this.repositoryFile);
        this.repositoryList = updatedRepoList.filter(repo => repo.url !== repoUrl);
      }
      catch (err) {
        // rollback
        const providers = cwUtils.deepClone(this.providers);
        this.providers = await addRepositoryToProviders(repoToDelete, providers).catch(error => log.warn(error.message));
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
      const currentRepoList = cwUtils.deepClone(this.repositoryList);
      const { operationResults, newRepositoryList: listOfModifiedRepositories } = await performOperationsOnRepositoryList(requestedOperations, currentRepoList);
      const newRepositoryList = updateRepositoryList(currentRepoList, listOfModifiedRepositories);
      // Don't fetch the templates just update the template lists
      const currentAllProjectTemplates = cwUtils.deepClone(this.allProjectTemplates);
      const { enabledTemplates, allTemplates } = updateTemplates(newRepositoryList, currentAllProjectTemplates);
      this.enabledProjectTemplates = enabledTemplates;
      this.allProjectTemplates = allTemplates;
      this.repositoryList = newRepositoryList;
      await writeRepositoryList(this.repositoryFile, this.repositoryList);
      return operationResults;
    } finally {
      this.unlock();
    }
  }

  // PROVIDERS
  async addProvider(name, provider) {
    this.lock();
    try {
      if (provider && typeof provider.getRepositories === 'function') {
        this.providers[name] = provider;
        const currentRepoList = cwUtils.deepClone(this.repositoryList);
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
}

// FUNCTIONS

/**
 * Save the default list to disk so the user can potentially edit it (WHEN CODEWIND IS NOT RUNNING)
 */
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

async function updateRepoListWithReposFromProviders(providers, repositoryList) {
  const providedRepos = await getReposFromProviders(Object.values(providers));

  const extraRepos = providedRepos.filter(providedRepo =>
    !repositoryList.find(existingRepo => existingRepo.url === providedRepo.url)
  );
  if (extraRepos.length > 0) {
    const reposWithCodewindSettings = await addCodewindSettingsToRepository(extraRepos);
    const newRepositoryList = repositoryList.concat(reposWithCodewindSettings);
    return newRepositoryList;
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
  let newRepo = cwUtils.deepClone(repo);

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

/**
 * Uses a template's sourceId, sourceURL or source (repo name) to get the repository for a given template
 * Ordered so that the source (repo name) is used as a fall back
 * Returns null if the repository cannot be found
 */
function getRepositoryFromTemplate(repositoryList, template) {
  const repo = repositoryList.find(repoToFind => (
    (template.sourceId && template.sourceId === repoToFind.id) ||
    (template.sourceURL && template.sourceURL === repoToFind.url) ||
    (template.source && template.source === repoToFind.name))
  );
  return repo || null;
}

/**
 * Function to update the template lists
 * Sets a template as enabled or disabled dependent on its repository's enabled value
 * If enabled it will be added to the enabledTemplates list
 * The allTemplates list will not be changed
 */
function updateTemplates(repositories, allTemplates) {
  const enabledTemplates = allTemplates.filter(template => {
    const repo = getRepositoryFromTemplate(repositories, template);
    return (repo && repo.enabled === true);
  });
  return { enabledTemplates, allTemplates }
}

async function fetchTemplates(repositories) {
  const enabledRepositories = repositories.filter(repo => repo.enabled);
  const disabledRepositories = repositories.filter(repo => !repo.enabled);
  const enabledTemplates = await getTemplatesFromRepos(enabledRepositories);
  const disabledTemplates = await getTemplatesFromRepos(disabledRepositories);
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
    if (repository.url) {
      template.sourceURL = repository.url;
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

async function addRepositoryToProviders(repo, providers) {
  const promises = [];
  for (const provider of Object.values(providers)) {
    if (typeof provider.canHandle === 'function') {
      // make a new copy for each provider to be invoked with
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
  return providers;
}

async function removeRepositoryFromProviders(repo, providers) {
  const promises = [];
  for (const provider of Object.values(providers)) {
    if (typeof provider.canHandle === 'function') {
      // make a new copy to for each provider to be invoked with
      // in case any provider modifies it (which they shouldn't do)
      const copy = Object.assign({}, repo);
      if (provider.canHandle(copy) && typeof provider.removeRepository === 'function')
        promises.push(provider.removeRepository(copy));
    }
  }
  await Promise.all(promises);
  return providers;
}

async function performOperationsOnRepositoryList(requestedOperations, repositoryList) {
  const newRepositoryList = [];
  const promiseList = requestedOperations.map(async operation => {
    const { operationResult, updatedRepo } = await performOperationOnRepository(operation, repositoryList);
    if (updatedRepo) {
      // Update the repository list with the new repository
      newRepositoryList.push(updatedRepo);
    }
    return operationResult;
  });
  const operationResults = await Promise.all(promiseList);
  return { operationResults, newRepositoryList }
}

async function performOperationOnRepository(operation, repositoryList) {
  const { op, url, value } = operation;
  const repo = repositoryList.find(repo => repo.url === url);
  let resultObject = {};
  if (op === 'enable') {
    resultObject = await enableOrDisableRepository({ value }, repo);
  }

  const { response: operationResult, updatedRepo } = resultObject;
  operationResult.requestedOperation = operation;
  return { operationResult, updatedRepo };
}

/**
 * @param {JSON} { url (URL of template repo to enable or disable), value (true|false)}
 * @returns {JSON} { response: { status, error (optional) }, updatedRepo (optional) }
 */
function enableOrDisableRepository({ value }, repo) {
  if (!repo) {
    return {
      response: {
        status: 404,
        error: 'Unknown repository URL',
      }
    }
  }
  try {
    repo.enabled = (value === 'true' || value === true);
    return {
      response: {
        status: 200,
      },
      updatedRepo: repo,
    }
  } catch (error) {
    return {
      response: {
        status: 500,
        error: error.message,
      }
    }
  }
}

/**
 * Updates repositories in the repositoryList with the updated values
 * New repositories will not be added
 * Repositories with no updates will be kept with no changes
 */
function updateRepositoryList(currentRepositoryList, updatedRepositories) {
  const newRepositoryList = currentRepositoryList.map(oldRepo => {
    const modifiedRepo = updatedRepositories.find(modifiedRepo => modifiedRepo.url === oldRepo.url);
    return modifiedRepo || oldRepo;
  });
  return newRepositoryList;
}
