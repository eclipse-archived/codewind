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

const ActionTypes = require('../actions/types');

/*
Redux reduce for fetching the metrics
*/
export default function reducer(
    state = {
        metrics: [],
        fetching: false,
        fetched: false,
        error: null,
        receivedAt: 0
    },
    action
) {
    switch (action.type) {
        case ActionTypes.FETCH_METRICS: {
            return { ...state, fetching: true };
        }
        case ActionTypes.FETCH_METRICS_REJECTED: {
            return {
                ...state,
                fetching: false,
                fetched: false,
                error: action.payload
            };
        }
        case ActionTypes.FETCH_METRICS_FULFILLED: {
            return { ...state, fetching: false, fetched: true, metrics: action.payload, receivedAt: action.receivedAt };
        }
        default: { /* default */ }
    }
    return state;
}