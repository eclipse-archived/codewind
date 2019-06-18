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

function requestMetrics() {
    return {
        type: ActionTypes.FETCH_METRICS
    };
}

function receivedMetrics(json) {
    return {
        type: ActionTypes.FETCH_METRICS_FULFILLED,
        payload: json,
        receivedAt: Date.now()
    };
}

function fetchRejected(json) {
    return {
        type: ActionTypes.FETCH_METRICS_REJECTED,
        payload: json
    };
}

function fetchMetrics(projectID, availableTypes) {

    let validTypes = {};
    // extract the availble types eg :   ["cpu", "memory", 'http'];
    validTypes.types = availableTypes.map(t => t.type);

    return dispatch => {
        dispatch(requestMetrics());
        return fetch(`${AppConstants.MICROCLIMATE_SERVER_API}/api/v1/projects/${projectID}/metrics/types`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(validTypes),
            }
        )
            .then(function (response) {
                let data = response.json();

                // 422 is expected for a project with empty load-test history
                if (response.status === 422) { return []; }
                if (response.status !== 200) {
                    if (data.message) {
                        return Promise.reject({ code: response.status, message: data.message });
                    } else {
                        return Promise.reject({ code: response.status, message: "Error: " + response.status });
                    }
                }
                return data;
            })
            .then(json => dispatch(receivedMetrics(json)))
            .catch(function (err) {
                const errCode = (err.code) ? err.code : 500;
                const errMessage = (err.message) ? err.message : err;
                dispatch(
                    fetchRejected({
                        code: errCode,
                        message: 'Unable to fetch Microclimate metrics',
                        err: `${errMessage}`
                    })
                );
            });
    };
}

/*
Check if the stats have already been loaded
*/
function shouldFetchMetrics(data) {
    if (!data || !data.statsMicroclimate || data.statsMicroclimate.length === 0) {
        return true;
    }
    return false;
}

/**
Consumers should call this function to retrieve metrics data
*/
function fetchProjectMetrics(data, projectID, availableTypes) {
    return (dispatch) => {
        if (shouldFetchMetrics(data)) {
            return dispatch(fetchMetrics(projectID, availableTypes));
        }
        return Promise.resolve();
    };
}

function postDeleteTest(projectID, timeSnapshotToDelete) {
    return fetch(`${AppConstants.MICROCLIMATE_SERVER_API}/api/v1/projects/${projectID}/metrics/${timeSnapshotToDelete}`,
        {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
        })
        .then(response => {
            if (response.status === 200) {
                return { status: response.status, message: 'OK' };
            }
            return { status: response.status, message: `Error: ${response.status}` };
        }).catch(err => {
            return ({
                "name": "ProjectMetricsError",
                "code": "ERR",
                "message": err
            });
        });
}

function reloadMetricsData(projectID, availableTypes) {
    return (dispatch) => {
        return dispatch(fetchMetrics(projectID, availableTypes));
    };
}

exports.fetchProjectMetrics = fetchProjectMetrics;
exports.postDeleteTest = postDeleteTest;
exports.reloadMetricsData = reloadMetricsData;