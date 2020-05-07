/*******************************************************************************
* Copyright (c) 2020 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/

const ActionTypes = require('./types');
let notificationID = 0;

export const KIND_INFO    = 'info';
export const KIND_SUCCESS = 'success';
export const KIND_WARNING = 'warning';
export const KIND_ERROR   = 'error';

function createNotification(options) {
  return {
    id: notificationID++,
    kind: KIND_INFO,
    timestamp: Date.now(),
    caption: '',
    title: '',
    subtitle: '',
    timeout: 0,
    ...options,
  };
}

export function addNotification(options) {
  return {
    payload: createNotification(options),
    type: ActionTypes.ADD_NOTIFICATION,
  };
}

export function removeNotification(notificationID) {
  return {
    payload: notificationID,
    type: ActionTypes.REMOVE_NOTIFICATION,
  };
}
