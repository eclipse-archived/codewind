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

import {fetchProjectLoadConfig, saveProjectLoadConfig}  from '../loadRunnerConfigActions';
import * as LoadRunnerConfig from '../../../tests/data/LoadRunnerConfig';
import reducers from '../../reducers/index';

// constants
const accessToken = 'TOKEN';
const projectID = '12345';

// initialize redux stores
const store = createStore(reducers, {
  loadRunnerConfigReducer: { config: {} },
}, applyMiddleware(thunk));

describe('loadRunnerConfigActions', () => {
  
  it('Downloads the project loadRunner configuration to the store for a valid project', () => {
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolve({
          status: 200,
          json() { return LoadRunnerConfig.projectLoadRunnerConfig; },
        });
      });
    });
    store.dispatch(fetchProjectLoadConfig(accessToken, projectID)).then(() => {
      expect (store.getState().loadRunnerConfigReducer.config).toBe(LoadRunnerConfig.projectLoadRunnerConfig);
      expect (store.getState().loadRunnerConfigReducer.fetched).toBe(true);
    });
  });

  it('Handles an error response from the API when the project was not found', () => {
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolve({
          status: 404,
          json() { return {}; },
        });
      });
    });
    store.dispatch(fetchProjectLoadConfig(accessToken, projectID)).then(() => {
      expect (store.getState().loadRunnerConfigReducer.fetched).toBe(false);
      expect (store.getState().loadRunnerConfigReducer.error.code).toBe(404);
      expect (store.getState().loadRunnerConfigReducer.error.message).toBe('Unable to fetch configuration');
      expect (store.getState().loadRunnerConfigReducer.error.err).toBe('Error: 404');
    });
  });

  it('Handles an error response from the API - when a message has been provided', () => {
    const errorCode = 500;
    const errorMessage = 'something-went-wrong-12345'
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolve({
          status: errorCode,
          json() { return {message: errorMessage };},
        });
      });
    });
    store.dispatch(fetchProjectLoadConfig(accessToken, projectID)).then(() => {
      expect (store.getState().loadRunnerConfigReducer.fetched).toBe(false);
      expect (store.getState().loadRunnerConfigReducer.error.code).toBe(errorCode);
      expect (store.getState().loadRunnerConfigReducer.error.message).toBe('Unable to fetch configuration');
      expect (store.getState().loadRunnerConfigReducer.error.err).toBe(errorMessage);
    });
  });


  it('Dispatches config changes to the API', () => {
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolve({
          status: 200,
          json() { return {}; },
        });
      });
    });
    store.dispatch(saveProjectLoadConfig(accessToken, projectID, LoadRunnerConfig.projectLoadRunnerConfig)).then(() => {
      expect (store.getState().loadRunnerConfigReducer.fetched).toBe(true);
    });
  });

  it('Handles an error responses from the API - Project not found', () => {
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolve({
          status: 404,
          json() { return { message: `something went wrong` }; },
        });
      });
    });
    store.dispatch(saveProjectLoadConfig(accessToken, projectID, LoadRunnerConfig.projectLoadRunnerConfig)).then(() => {
      expect (store.getState().loadRunnerConfigReducer.fetched).toBe(false);
      expect (store.getState().loadRunnerConfigReducer.error.code).toBe(404);
      expect (store.getState().loadRunnerConfigReducer.error.message).toBe('Unable to save configuration');
      expect (store.getState().loadRunnerConfigReducer.error.err).toBe(`something went wrong`);
    });
  });

  it('Handles an error responses from the API - when no message was provided', () => {
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolve({
          status: 404,
          json() { return { }; },
        });
      });
    });
    store.dispatch(saveProjectLoadConfig(accessToken, projectID, LoadRunnerConfig.projectLoadRunnerConfig)).then(() => {
      expect (store.getState().loadRunnerConfigReducer.fetched).toBe(false);
      expect (store.getState().loadRunnerConfigReducer.error.code).toBe(404);
      expect (store.getState().loadRunnerConfigReducer.error.message).toBe('Unable to save configuration');
      expect (store.getState().loadRunnerConfigReducer.error.err).toBe(`Error: 404`);
    });
  });
});