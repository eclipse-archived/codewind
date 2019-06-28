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

const UserListError = require('./utils/errors/UserListError.js');
const Logger = require('./utils/Logger.js');

const log = new Logger('UserList.js');
/**
 * The UserList class
 */
module.exports = class UserList {
  constructor() {
    this._list = {};
  }

  /**
   * Function to add a user to the userList
   * Throws an error if the user already exists or if an additional user is being added in single user mode
   * @param user, the user to add to the userList
   */
  add(user) {
    log.debug(`Adding user to list - id: ${user.user_id}`);
    if (this._list.hasOwnProperty(user.user_id)) throw new UserListError('ALREADY_EXISTS', user.user_id);
    if (!global.codewind.MULTI_USER && Object.keys(this._list).length > 0) throw new UserListError('TOO_MANY_USERS', user.user_id);
    this._list[user.user_id] = user;
  }

  /**
   * Function to remove a user from the userList
   * Throws an error if the user doesn't exist
   * @param id, the id of the user to remove
   */
  remove(id) {
    log.debug(`Removing user from list - id: ${id}`);
    if (!this._list.hasOwnProperty(id)) {
      throw new UserListError('USER_NOT_FOUND', id);
    } else {
      delete this._list[id];
    }
  }

  /**
   * Function to retrieve a user from the userList
   * Throws an error if the user doesn't exist
   * @param id, the id of the user to return
   * @return the requested user
   */
  retrieve(id) {
    let normalisedID;
    if (global.codewind.MULTI_USER) {
      normalisedID = String(id).replace(/@|_|\./g,'-').toLowerCase(); // normalise email userids
    } else {
      normalisedID = id;
    }
    if (!this._list.hasOwnProperty(normalisedID)) throw new UserListError('USER_NOT_FOUND', id);
    return this._list[normalisedID];
  }

  /**
   * Function to update a user's values
   * If we are given existing fields these overwrite the ones
   * in the current user. If we are given new fields they
   * are added to the current user
   * Throws an error if the User doesn't exist
   * @param {Object} updatedUser, the updatedUser object
   * @return the updated user
   */
  update(updatedUser) {
    if (!this._list.hasOwnProperty(updatedUser.user_id)) {
      throw new UserListError('USER_NOT_FOUND', updatedUser.user_id);
    } else {
      let currentUser = this._list[updatedUser.user_id];
      for (let key in updatedUser) {
        currentUser[key] = updatedUser[key];
      }
      this._list[updatedUser.user_id] = currentUser;
      return this._list[updatedUser.user_id];
    }
  }

  /**
   * Function to get all the users in an array. Returns only their id's not the objects
   */
  getAllUserIDs() {
    let array = [];
    for (let key in this._list) {
      array.push(key);
    }
    return array;
  }
}
