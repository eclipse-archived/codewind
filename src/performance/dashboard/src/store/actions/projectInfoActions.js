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

var AppConstants = require('../../AppConstants');
const ActionTypes = require('./types');

function requestConfig() {
    return {
        type: ActionTypes.FETCH_PROJECTINFO
    };
}

function receivedConfig(json) {
    return {
        type: ActionTypes.FETCH_PROJECTINFO_FULFILLED,
        payload: json,
        receivedAt: Date.now()
    };
}

function fetchRejected(json) {
    return {
        type: ActionTypes.FETCH_PROJECTINFO_REJECTED,
        payload: json
    };
}

function fetchConfig(access_token, projectID) {
    return dispatch => {
        dispatch(requestConfig());
        return fetch(`${AppConstants.API_SERVER}/api/v1/projects/${projectID}`,
            {
                method: "GET",
                headers: { "Content-Type": "application/json",  Authorization: `Bearer ${access_token}` }
            }
        ).then(function (response) {
            let data = response.json();
            if (response.status !== 200) {
                if (data.message) {
                    return Promise.reject({ code: response.status, message: data.message });
                } else {
                    return Promise.reject({ code: response.status, message: "Error: " + response.status });
                }
            }
            return data;
        })
            .then(json => dispatch(receivedConfig(json)))
            .catch(function (err) {
                const errCode = (err.code) ? err.code : 500;
                const errMessage = (err.message) ? err.message : err;
                dispatch(
                    fetchRejected({
                        code: errCode,
                        message: 'Unable to fetch configuration',
                        err: `${errMessage}`
                    })
                );
            });
    };
}

/**
Consumers should call this function to retrieve the config
*/
function fetchProjectConfig(access_token, projectID) {
    return (dispatch) => {
        return dispatch(fetchConfig(access_token, projectID));
    };
}

exports.fetchProjectConfig = fetchProjectConfig;
