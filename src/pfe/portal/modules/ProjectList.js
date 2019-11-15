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

const ProjectListError = require('./utils/errors/ProjectListError');
const Logger = require('./utils/Logger');
const log = new Logger('ProjectList.js');

// list of properties that must never be changed once created
const keysOfConstantProperties = ['codewindVersion', 'projectID'];

/**
 * The ProjectList class
 * Contains the projectList and functions to manipulate it
 * Also contains functions to
 *    - check whether a project is reachable (HTTP request)
 *    - get the container logs for each project
 * One per User
 */
module.exports = class ProjectList {
  constructor() {
    this._list = {};
  }

  /**
   * Function to return the current projectList
   * @return this._list, the projectList
   */
  get list() {
    return this._list;
  }

  /**
   * Function to add a project to the projectList
   * Throws an error if the project already exists
   * @param project, the project to add to the projectList
   */
  addProject(project) {
    if (this._list.hasOwnProperty(project.projectID)) {
      throw new ProjectListError('ALREADY_EXISTS', project.projectID);
    } else {
      this._list[project.projectID] = project;
    }
  }

  projectNameExists(name) {
    for (const project in this._list) {
      if(this._list[project].name == name) {
        return true;
      }
    }
    return false;
  }

  /**
   * Function to remove a project from the projectList
   * Throws an error if the project doesn't exist
   * @param id, the id (projectID) of the project to delete
   */
  removeProject(id) {
    if (!this._list.hasOwnProperty(id)) {
      throw new ProjectListError('NOT_FOUND', id);
    } else {
      delete this._list[id];
    }
  }

  /**
   * Function to retrive a project from the projectList
   * Throws an error if the project doesn't exist
   * @param id, the id (projectID) of the project to return
   * @return the requested project
   */
  retrieveProject(id) {
    return (this._list.hasOwnProperty(id) ? this._list[id] : undefined);
  }

  /**
   * Function to update a project's values
   * If we are given existing fields these overwrite the ones
   * in the current project. If we are given new fields they
   * are added to the current project
   * @param {Object} updatedProject, the updatedProject object
   * @return {Promise<Object>} the updated project
   */
  async updateProject(updatedProject) {
    if (!updatedProject.hasOwnProperty('projectID')) {
      throw new ProjectListError('MALFORMED', null, "Project does not have a project ID");
    }
    if (!this._list.hasOwnProperty(updatedProject.projectID)) {
      throw new ProjectListError('NOT_FOUND', updatedProject.projectID);
    }
    const currentProject = this._list[updatedProject.projectID];
    for (let key in updatedProject) {
      if (!keysOfConstantProperties.includes(key))
        currentProject[key] = updatedProject[key];
      if (key === 'appStatus' && currentProject[key] === 'started') {
        log.info(`Project ${currentProject.name} started (project ID: ${currentProject.projectID})`);
        if (process.env.CHE_INGRESS_HOST) {
          currentProject.host = process.env.CHE_INGRESS_HOST;
        }
      }
    }
    this._list[updatedProject.projectID] = currentProject;
    await this._list[updatedProject.projectID].writeInformationFile();
    return this._list[updatedProject.projectID];
  }

  /**
   * Function to reload a project's .cw-settings file to update the internal
   * project object
   * @param {Object} reloadProject, object containing the projectID of the
   * project to reload the settings file
   * @return the updated project
   */
  async reloadSettingsFile(reloadProject) {
    if (!reloadProject.hasOwnProperty('projectID')) {
      throw new ProjectListError('MALFORMED', null, "Project does not have a project ID");
    }
    if (!this._list.hasOwnProperty(reloadProject.projectID)) {
      throw new ProjectListError('NOT_FOUND', reloadProject.projectID);
    }
    const currentProject = this._list[reloadProject.projectID];
    let settingsFileContents = await currentProject.readSettingsFile();
    settingsFileContents.projectID = currentProject.projectID;
    return this.updateProject(settingsFileContents);
  }

  /**
   * Function to delete a project's value
   * @param {projectID} projectID, the id of the project to update
   * @param {key} key, the key to delete
   * @return the updated project
   */
  async deleteProjectKey(projectID, key) {
    if (!this._list.hasOwnProperty(projectID)) {
      throw new ProjectListError('NOT_FOUND', projectID);
    }
    let currentProject = this._list[projectID];
    if (currentProject.hasOwnProperty(key)) {
      delete currentProject[key];
      this._list[projectID] = currentProject;
      await this._list[projectID].writeInformationFile();
    }
    return this._list[projectID];
  }

  /**
   * Function to return the projectList as an array
   * Used to send a list of projects to the UI
   * @return array, the projectList as an array
   */
  getAsArray() {
    let array = [];
    for (let key in this._list) {
      array.push(this._list[key]);
    }
    return array;
  }
}
