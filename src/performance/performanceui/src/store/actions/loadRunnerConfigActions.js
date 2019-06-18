/*******************************************************************************
Licensed Materials - Property of IBM
"Restricted Materials of IBM"
Copyright IBM Corp. 2019 All Rights Reserved
US Government Users Restricted Rights - Use, duplication or disclosure
restricted by GSA ADP Schedule Contract with IBM Corp.
*******************************************************************************/
const queryString = require('query-string');
var AppConstants = require('../../AppConstants');
const ActionTypes = require('./types');

function requestConfig() {
    return {
        type: ActionTypes.FETCH_PROJECTLOAD_CONFIG
    };
}

function receivedConfig(json) {
    return {
        type: ActionTypes.FETCH_PROJECTLOAD_FULFILLED,
        payload: json,
        receivedAt: Date.now()
    };
}

function fetchRejected(json) {
    return {
        type: ActionTypes.FETCH_PROJECTLOAD_REJECTED,
        payload: json
    };
}

function writeConfig() {
    return {
        type: ActionTypes.FETCH_PROJECTLOAD_SAVE_CONFIG
    };
}

function savedConfig(config) {
    return {
        type: ActionTypes.FETCH_PROJECTLOAD_SAVE_FULFILLED,
        payload: config,
        receivedAt: Date.now()
    };
}

function fetchWriteRejected(json) {
    return {
        type: ActionTypes.FETCH_PROJECTLOAD_SAVE_REJECTED,
        payload: json
    };
}


function fetchConfig(projectID) {
    return dispatch => {
        dispatch(requestConfig());
        return fetch(`${AppConstants.MICROCLIMATE_SERVER_API}/api/v1/projects/${projectID}/loadtest/config`,
            {
                method: "GET",
                headers: { "Content-Type": "application/json" }
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
* Post the config back to to portal. 
* @param {*} projectID 
* @param {*} configFileContents The api will expect the body in the format : 
* 
* { 
*   "path": "/projectAPI",
*   "query": { "a": "1", "b": "2", "c": "3" },
*   "requestsPerSecond": "100",
*   "concurrency": "20",
*   "maxSeconds": "20"
* }
* 
*/
function saveConfig(projectID, config) {

    // Clone the config then update it with path and query in the form requwired by the loadtest/config API
    let formattedContents = Object.assign({}, config);
    let tmpPath = queryString.parseUrl(config.path);
    formattedContents.path = tmpPath.url;
    formattedContents.query = tmpPath.query;

    return dispatch => {
        dispatch(writeConfig());
        return fetch(`${AppConstants.MICROCLIMATE_SERVER_API}/api/v1/projects/${projectID}/loadtest/config`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formattedContents)
            }
        ).then(function (response) {        
            if (response.status !== 200) {
                let data = response.json();
                if (data.message) {
                    return Promise.reject({ code: response.status, message: data.message });
                } else {
                    return Promise.reject({ code: response.status, message: "Error: " + response.status });
                }
            }
            return;
        }).then(dispatch(savedConfig(config)))
            .catch(function (err) {
                const errCode = (err.code) ? err.code : 500;
                const errMessage = (err.message) ? err.message : err;
                dispatch(
                    fetchWriteRejected({
                        code: errCode,
                        message: 'Unable to save configuration',
                        err: `${errMessage}`
                    })
                );
            });
    };
}

/**
Consumers should call this function to retrieve the config
*/
function fetchProjectLoadConfig(projectID) {
    return (dispatch) => {
        return dispatch(fetchConfig(projectID));
    };
}

/**
* @param {*} projectID           Project to update
* @param {*} newConfigFileContents  JSONObject contents of the config.json file
*/
function saveProjectLoadConfig(projectID, newConfigFileContents) {
    return (dispatch) => {
        return dispatch(saveConfig(projectID, newConfigFileContents));
    };
}

exports.fetchProjectLoadConfig = fetchProjectLoadConfig;
exports.saveProjectLoadConfig = saveProjectLoadConfig;
