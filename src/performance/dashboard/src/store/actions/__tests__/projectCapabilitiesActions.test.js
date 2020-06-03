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
import * as MockProjectInfo from '../../../tests/data/ProjectInfo';
import * as MockProjectCapabilities from '../../../tests/data/ProjectCapabilitiesInfo';
import { fetchProjectCapabilities }  from '../projectCapabilitiesActions';
import reducers from '../../reducers/index';

// constants
const accessToken = 'TOKEN';
const projectID = MockProjectInfo.projectInfo.projectID;

// initialize redux stores
const store = createStore(reducers, {
  projectInfoReducer: {
    capabilities  : [],
    fetching: false,
    fetched: false,
    error: null,
    receivedAt: 0,
  },
}, applyMiddleware(thunk));

describe('projectInfoActions', () => {
  it('Downloads the project capabilities for a valid project', () => {
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolve({
          status: 200,
          json() { return MockProjectCapabilities.capabilitiesData; },
        });
      });
    });

    store.dispatch(fetchProjectCapabilities(accessToken, projectID)).then(() => {
      expect (store.getState().projectCapabilitiesReducer.capabilities).toBe(MockProjectCapabilities.capabilitiesData); 
      expect (store.getState().projectCapabilitiesReducer.fetched).toBe(true);
    });
  });

  it('Handles an error response from the API when the project was not found', () => {
    const errorCode = 404;
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolve({
          status: errorCode,
          json() { return {}; },
        });
      });
    });
    store.dispatch(fetchProjectCapabilities(accessToken,  projectID)).then(() => {
      expect (store.getState().projectCapabilitiesReducer.fetched).toBe(false);
      expect (store.getState().projectCapabilitiesReducer.error.code).toBe(errorCode);
      expect (store.getState().projectCapabilitiesReducer.error.message).toBe('Unable to fetch project capabilities');
      expect (store.getState().projectCapabilitiesReducer.error.err).toBe(`Error: ${errorCode}`);
    });
  });

  it('Handles an error response from the API - when a message has been provided', () => {
    const errorCode = 500;
    const errorMessage = 'something-went-wrong-12345';
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolve({
          status: errorCode,
          json() { return {message: errorMessage };},
        });
      });
    });
    store.dispatch(fetchProjectCapabilities(accessToken, projectID)).then(() => {
      expect (store.getState().projectCapabilitiesReducer.fetched).toBe(false);
      expect (store.getState().projectCapabilitiesReducer.error.code).toBe(errorCode);
      expect (store.getState().projectCapabilitiesReducer.error.message).toBe('Unable to fetch project capabilities');
      expect (store.getState().projectCapabilitiesReducer.error.err).toBe(errorMessage);
    });
  });
});
