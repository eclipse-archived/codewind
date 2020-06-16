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

const ProjectLinkError = require('../utils/errors/ProjectLinkError');
const Logger = require('../utils/Logger');
const log = new Logger(__filename);

/**
 * The Links class
 */
class Links {
  constructor(directory, args) {
    this._links = (args && args._links) ? args._links : [];
    this.fileName = '.codewind-project-links.env'; // This will be in the users container (not local disk)
    this.filePath = path.join(directory, this.fileName);
  }

  getFileName() {
    return this.fileName;
  }

  getFilePath() {
    return this.filePath;
  }

  envFileExists() {
    return fs.pathExists(this.filePath);
  }

  getAll() {
    return this._links;
  }

  get(envNameToFind) {
    const link = this._links.find(({ envName }) => envName === envNameToFind);
    if (!link) {
      throw new ProjectLinkError('NOT_FOUND', envNameToFind);
    }
    return link;
  }

  getEnvPairs() {
    return this.getAll().map(({ envName, projectURL }) => `${envName}=${projectURL}`)
  }

  getEnvPairObject() {
    const links = this.getAll();
    const obj = {};
    for (const link of links) {
      const { envName, projectURL } = link;
      obj[envName] = projectURL;
    }
    return obj;
  }

  async add(newLink) {
    const { projectURL, envName } = newLink;
    const validatedLink = validateLink(newLink, this._links);
    log.info(`Link added - envName: ${envName}, projectURL: ${projectURL}`);
    this._links.push(validatedLink);
    await updateEnvironmentFile(this.filePath, this.getEnvPairs());
  }

  async update(envName, newEnvName) {
    const linkIndex = this._links.findIndex(link => link.envName === envName);
    if (linkIndex === -1) {
      throw new ProjectLinkError('NOT_FOUND', envName);
    }
    const currentLink = this._links[linkIndex];

    // Clone and remove the updated link so we only validate against all other links
    const linksWithoutOneToBeUpdated = this._links.filter(link => link.envName !== envName);

    this._links[linkIndex] = validateLink({ ...currentLink, envName: newEnvName }, linksWithoutOneToBeUpdated);
    log.info(`Link updated - env: ${envName} properties changed to envName: ${newEnvName}`);
    await updateEnvironmentFile(this.filePath, this.getEnvPairs());
  }

  async delete(envName) {
    const linkIndex = this._links.findIndex(link => link.envName === envName);
    if (linkIndex === -1) {
      throw new ProjectLinkError('NOT_FOUND', envName);
    }
    this._links.splice(linkIndex, 1);
    log.info(`Link ${envName} deleted`);
    await updateEnvironmentFile(this.filePath, this.getEnvPairs());
  }

  async deleteByTargetProjectID(targetProjectID) {
    // Check that atleast one link exists with the targetProjectID
    const targetProjectIDisValidLink = this.getAll().find(({ projectID }) => projectID === targetProjectID);
    if (targetProjectIDisValidLink) {
      this._links = this.getAll().filter(({ projectID }) => projectID !== targetProjectID);
      await updateEnvironmentFile(this.filePath, this.getEnvPairs());
    }
    // Return whether the targetProject is a valid link (indicates whether project should be restarted)
    return targetProjectIDisValidLink;
  }
}

function validateLink(newLink, links) {
  const { projectID, projectName, envName, projectURL } = newLink;
  if (!projectID || !projectName || !envName || !projectURL) {
    log.error(newLink);
    throw new ProjectLinkError(`INVALID_PARAMETERS`, newLink.envName);
  }

  // Check for duplicate env name
  const duplicatedEnvName = envNameExists(links, envName);
  if (duplicatedEnvName) {
    throw new ProjectLinkError('EXISTS', envName);
  }
  return newLink;
}

function envNameExists(links, envName) {
  const envList = links.map(link => link.envName);
  return envList.includes(envName);
}

function updateEnvironmentFile(filePath, envPairArray) {
  if (envPairArray.length === 0) {
    return fs.remove(filePath);
  }
  let fileContents = envPairArray.join('\n');
  // Add new line to the end of string
  fileContents += '\n';
  return fs.writeFile(filePath, fileContents);
}

module.exports = Links;
