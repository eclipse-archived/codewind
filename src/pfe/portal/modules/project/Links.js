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

const ENV_FILE_NAME = '.codewind-project-links.env'; // This will be in the users container

/**
 * The Links class
 */
class Links {
  constructor(directory, args) {
    this._links = (args && args._links) ? args._links : [];
    this.filePath = path.join(directory, ENV_FILE_NAME);
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

  async add(newLink) {
    const { projectURL, envName } = newLink;
    const validatedLink = validateLink(newLink, this._links);
    log.info(`Link added - envName: ${envName}, projectURL: ${projectURL}`);
    this._links.push(validatedLink);
    await writeEnvironmentFile(this.filePath, this.getEnvPairs());
  }

  async update(envName, newEnvName, newProjectURL) {
    const linkIndex = this._links.findIndex(link => link.envName === envName);
    if (linkIndex === -1) {
      throw new ProjectLinkError('NOT_FOUND', envName);
    }
    const currentLink = this._links[linkIndex];

    // Clone and remove the updated link so we only validate against all other links
    const linksWithoutOneToBeUpdated = this._links.filter(link => link.envName !== envName);

    this._links[linkIndex] = validateLink({ ...currentLink, envName: newEnvName, projectURL: newProjectURL }, linksWithoutOneToBeUpdated);
    log.info(`Link updated - env: ${envName} properties changed to envName: ${newEnvName} projectURL: ${newProjectURL}`);
    await writeEnvironmentFile(this.filePath, this.getEnvPairs());
  }

  async delete(envName) {
    const linkIndex = this._links.findIndex(link => link.envName === envName);
    if (linkIndex === -1) {
      throw new ProjectLinkError('NOT_FOUND', envName);
    }
    this._links.splice(linkIndex, 1);
    log.info(`Link ${envName} deleted`);
    await writeEnvironmentFile(this.filePath, this.getEnvPairs());
  }
}

const validateLink = (newLink, links) => {
  const { projectID, parentPFEURL, envName, projectURL, type } = newLink;
  // Only require a parentPFEURL and projectURL if the link is remote
  // If the link is local then the parentPFEURL is not required and the projectURL can be undefined
  if (!projectID || !envName || !type || (type === Links.TYPES.REMOTE && (!parentPFEURL || !projectURL))) {
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

const envNameExists = (links, envName) => {
  const envList = links.map(link => link.envName);
  return envList.includes(envName);
}

const writeEnvironmentFile = async (filePath, envPairArray) => {
  const fileContents = envPairArray.join('\n');
  await fs.writeFile(filePath, fileContents);
}

Links.TYPES = {
  LOCAL: 'LOCAL', // Target project is running on the same PFE
  REMOTE: 'REMOTE', // Target project is running on a different PFE
}

module.exports = Links;
