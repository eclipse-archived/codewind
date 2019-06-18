/*******************************************************************************
Licensed Materials - Property of IBM
"Restricted Materials of IBM"
Copyright IBM Corp. 2019 All Rights Reserved
US Government Users Restricted Rights - Use, duplication or disclosure
restricted by GSA ADP Schedule Contract with IBM Corp.
*******************************************************************************/

const ActionTypes = require('../actions/types');

/*
Redux reduce for fetching the metrics
*/
export default function reducer(
    state = {
        config: [],
        fetching: false,
        fetched: false,
        error: null,
        receivedAt: 0
    },
    action
) {
    switch (action.type) {
        case ActionTypes.FETCH_PROJECTLOAD_CONFIG: {
            return { ...state, fetching: true };
        }
        case ActionTypes.FETCH_PROJECTLOAD_SAVE_REJECTED: 
        case ActionTypes.FETCH_PROJECTLOAD_REJECTED: {
            return {
                ...state,
                fetching: false,
                fetched: false,
                error: action.payload
            };
        }
        case ActionTypes.FETCH_PROJECTLOAD_SAVE_FULFILLED: 
        case ActionTypes.FETCH_PROJECTLOAD_FULFILLED: {
            return { ...state, fetching: false, fetched: true, config: action.payload, receivedAt: action.receivedAt };
        }
        default: { /* default */ }
    }
    return state;
} 
