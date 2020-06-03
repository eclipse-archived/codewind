/*******************************************************************************
* Copyright (c) 2020 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
*******************************************************************************/

import { createStore, applyMiddleware} from 'redux';
import thunk from 'redux-thunk';

import {setCounters}  from '../chartCounterActions';
import reducers from '../../reducers/index';

// initialize redux stores
const store = createStore(reducers, {
  chartCountersReducer: { enabledCounters: {} },
}, applyMiddleware(thunk));

describe('setCounters', () => {
  it('Updates store with new counter selection states', () => {
    store.dispatch( setCounters(
      [
        {name: 'cpu', enabled: 'true' },
        {name: 'memory', enabled: 'false' },
      ]
    ));
    expect (store.getState().chartCountersReducer.enabledCounters.length).toBe(2);
    expect (store.getState().chartCountersReducer.enabledCounters[0].name).toBe('cpu');
    expect (store.getState().chartCountersReducer.enabledCounters[1].name).toBe('memory');
  });
});
