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

import { SET_CHART_COUNTERS } from './types';

export const countersSet = counterList => ({
    type: SET_CHART_COUNTERS,
    enabledCounters: counterList
});

/*
* Save new counterList to store
* counterList is an array of counters and their enabled state eg :   [ {name: 'cpu', enabled: 'true' }, {name: 'memory', enabled: 'false' }]
*/
export const setCounters = counterList => (dispatch) => {
    dispatch(countersSet(counterList));
}
