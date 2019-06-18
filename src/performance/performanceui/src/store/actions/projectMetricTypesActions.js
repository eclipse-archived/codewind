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

var AppConstants = require('../../AppConstants');
const ActionTypes = require('./types');

function requestMetricTypes() {
    return {
        type: ActionTypes.FETCH_METRIC_TYPES
    };
}

function receivedMetricTypes(json) {
    return {
        type: ActionTypes.FETCH_METRIC_TYPES_FULFILLED,
        payload: json,
        receivedAt: Date.now()
    };
}

function fetchRejected(json) {
    return {
        type: ActionTypes.FETCH_METRIC_TYPES_REJECTED,
        payload: json
    };
}

function fetchMetricTypes(projectID) {
    return dispatch => {
        dispatch(requestMetricTypes());
        return fetch(`${AppConstants.MICROCLIMATE_SERVER_API}/api/v1/projects/${projectID}/metrics`)
            .then(function (response) {
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
            .then(json => { dispatch(receivedMetricTypes(json)) })
            .catch(function (err) {
                const errCode = (err.code) ? err.code : 500;
                const errMessage = (err.message) ? err.message : err;
                dispatch(
                    fetchRejected({
                        code: errCode,
                        message: 'Unable to fetch a list of metric types',
                        err: `${errMessage}`
                    })
                );
            });
    };
}

/*
Check if the stats have already been loaded, if not, load them now ie cache contents
*/
function shouldFetchMetricTypes(data) {
    if (!data || !data.types || data.types.length === 0) {
        return true;
    }
    return false;
}

/**
Consumers should call this function to retrieve a list of which metrics are available
*/
function fetchProjectMetricTypes(data, projectID) {
    return (dispatch) => {
        if (shouldFetchMetricTypes(data)) {
            return dispatch(fetchMetricTypes(projectID));
        }
        return Promise.resolve();
    };
}

exports.fetchProjectMetricTypes = fetchProjectMetricTypes;
