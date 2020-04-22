/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/

const AppConstants = require('../../AppConstants');
const ActionTypes = require('./types');

function requestCapabilities() {
  return {
    type: ActionTypes.FETCH_PROJECT_CAPABILITIES,
  };
}

function receivedCapabilities(json) {
  return {
    type: ActionTypes.FETCH_PROJECT_CAPABILITIES_FULFILLED,
    payload: json,
    receivedAt: Date.now(),
  };
}

function fetchRejected(json) {
  return {
    type: ActionTypes.FETCH_PROJECT_CAPABILITIES_REJECTED,
    payload: json,
  };
}

function fetchCapabilities(projectID) {
  return dispatch => {
    dispatch(requestCapabilities());
    return fetch(`${AppConstants.API_SERVER}/api/v1/projects/capabilities/${projectID}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    ).then(function(response) {
      const data = response.json();
      if (response.status !== 200) {
        if (data.message) {
          return Promise.reject({ code: response.status, message: data.message });
        }
        return Promise.reject({ code: response.status, message: `Error: ${response.status}` });
      }
      return data;
    })
      .then(json => dispatch(receivedCapabilities(json)))
      .catch(function(err) {
        const errCode = (err.code) ? err.code : 500;
        const errMessage = (err.message) ? err.message : err;
        dispatch(
          fetchRejected({
            code: errCode,
            message: 'Unable to fetch project capabilities',
            err: `${errMessage}`,
          }),
        );
      });
  };
}

/**
Consumers should call this function to retrieve the project capabilities
*/
function fetchProjectCapabilities(projectID) {
  return (dispatch) => {
    return dispatch(fetchCapabilities(projectID));
  };
}

exports.fetchProjectCapabilities = fetchProjectCapabilities;
