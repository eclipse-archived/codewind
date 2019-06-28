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

/*
Redux reduce for fetching the available metric types
*/
const ActionTypes = require('../actions/types');

export default function reducer(
    state = {
        types: [],
        fetching: false,
        fetched: false,
        error: null
    },
    action
) {
    switch (action.type) {
        case ActionTypes.FETCH_METRIC_TYPES: {
            return { ...state, fetching: true };
        }
        case ActionTypes.FETCH_METRIC_TYPES_REJECTED: {
            return {
                ...state,
                fetching: false,
                fetched: false,
                error: action.payload
            };
        }
        case ActionTypes.FETCH_METRIC_TYPES_FULFILLED: {
            return { ...state, fetching: false, fetched: true, types: action.payload };
        }
        default: { /*default*/ }
    }
    return state;
}