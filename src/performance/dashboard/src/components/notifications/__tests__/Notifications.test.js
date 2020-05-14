/*******************************************************************************
* Copyright (c) 2020 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
**/

import React from 'react';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { render, cleanup } from '@testing-library/react';

import * as actions from '../../../store/actions/notificationsActions';
import * as types from '../../../store/actions/types';
import reducers from '../../../store/reducers/index';
import notificationsReducer from '../../../store/reducers/notificationsReducer';
import Notifications from '../Notifications';

// test notifications
const currentTime = Date.now();
const testNotification_1 = { id: 1, title: 'A test error message', timestamp: currentTime, caption: '', subtitle: 'error sub', kind: "error", timeout: 0 }
const testNotification_2 = { id: 2, title: 'A test warning message', timestamp: currentTime, caption: '', subtitle: 'warning sub', kind: "warning", timeout: 0 }
const testNotification_3 = { id: 3, title: 'A test info message', timestamp: currentTime, caption: '', subtitle: 'info sub', kind: "info", timeout: 0 }

// initialize component props
const componentProps = { }

// Initialize redux stores
const store = createStore(reducers, {
  notificationsReducer: []
});

// component to render
const wrapper = (
  <Provider store={store}>
    <Notifications {...componentProps} />
  </Provider>
)

// do not leak state
afterEach(cleanup);

// Mute console output
console.error = () => { }

// constants

/**s
 * Test functionality of the Notifications dialog
 */
describe('<Notifications />', () => {
  test('panel displays without crashing', () => {
    render(wrapper);
    expect(document.querySelectorAll('.Notifications').length).toBe(1);
  });

  test('Adding two messages render exactly two notifications', () => {
    const storeAdd = createStore(reducers, {
      notificationsReducer: [{ id: 0, title: "MyNotification100", kind: "info", timeout: 0 }, { id: 1, title: "MyNotification200", kind: "info", timeout: 0 }]
    });
    const wrapper_updated = (
      <Provider store={storeAdd}>
        <Notifications {...componentProps} />
      </Provider>
    )
    render(wrapper_updated);
    expect(document.querySelectorAll('.ToastNotification').length).toBe(2);
  });

  test('Adding 1 error and 1 info and 1 warning message renders one of each type', async () => {
    const storeWith3Messages = createStore(reducers, {
      notificationsReducer: [
       testNotification_1, testNotification_2, testNotification_3
      ]
    });

    const wrapper_updated = (
      <Provider store={storeWith3Messages}>
        <Notifications {...componentProps} />
      </Provider>
    )
    const { getAllByText } = render(wrapper_updated);
    const labelInfo = getAllByText('A test info message');
    expect(labelInfo.length).toBe(1);
    const labelWarning = getAllByText('A test warning message');
    expect(labelWarning.length).toBe(1);
    const labelError = getAllByText('A test error message');
    expect(labelError.length).toBe(1);
  });

  describe('Notifications match type', () => {
    test('An info message renders an info notification', async () => {
      const storeWithMessages = createStore(reducers, {
        notificationsReducer: [
          { id: 0, title: 'An info message', timestamp: Date.now(), caption: '', subtitle: 'info sub', kind: "info", timeout: 0 }]
      });
      const wrapper_updated = (
        <Provider store={storeWithMessages}>
          <Notifications {...componentProps} />
        </Provider>
      )
      render(wrapper_updated);
      const notificationNode = document.querySelector('.ToastNotification');
      expect(notificationNode.getAttribute("kind")).toBe("info");
    });

    test('A warning message renders a warning notification', async () => {
      const storeWithMessages = createStore(reducers, {
        notificationsReducer: [
          { id: 0, title: 'An warning message', timestamp: Date.now(), caption: '', subtitle: 'warning sub', kind: "warning", timeout: 0 }]
      });
      const wrapper_updated = (
        <Provider store={storeWithMessages}>
          <Notifications {...componentProps} />
        </Provider>
      )
      render(wrapper_updated);
      const notificationNode = document.querySelector('.ToastNotification');
      expect(notificationNode.getAttribute("kind")).toBe("warning");
    });

    test('An error message renders an error notification', async () => {
      const storeWithMessages = createStore(reducers, {
        notificationsReducer: [
          { id: 0, title: 'An error message', timestamp: Date.now(), caption: '', subtitle: 'error sub', kind: "error", timeout: 0 }]
      });
      const wrapper_updated = (
        <Provider store={storeWithMessages}>
          <Notifications {...componentProps} />
        </Provider>
      )
      render(wrapper_updated);
      const notificationNode = document.querySelector('.ToastNotification');
      expect(notificationNode.getAttribute("kind")).toBe("error");
    });
  });

  describe('Global notification actions', () => {
    it('should create an action to add a notification', () => {
      const newNotification = { id: 0, title: 'An error message', timestamp: Date.now(), caption: '', subtitle: 'error sub', kind: "error", timeout: 0 }
      const expectedAction = {
        type: types.ADD_NOTIFICATION,
        payload: newNotification
      }
      expect(actions.addNotification(newNotification)).toEqual(expectedAction)
    })

    it('should create an action to remove a notification', () => {
      const expectedAction = {
        type: types.REMOVE_NOTIFICATION,
        payload: 100
      }
      expect(actions.removeNotification(100)).toEqual(expectedAction)
    })
  });

  describe('Global notifications reducer', () => {
    it('should return an initial empty collection of notifications', () => {
      expect(notificationsReducer(undefined, {})).toEqual([]);
    });

    it('should handle adding a new notification', () => {
      expect(
        notificationsReducer([], {
          type: types.ADD_NOTIFICATION,
          payload: testNotification_1,
        })
      ).toEqual([
        testNotification_1
      ])

      // Add a second notification
      expect(
        notificationsReducer([testNotification_1],
          {
            type: types.ADD_NOTIFICATION,
            payload: testNotification_2,
          }
        )
      ).toEqual(
        [testNotification_2, testNotification_1]
      )
    });

    it('should handle removing a single notification by its ID', () => {
      const currentTime = Date.now();
      const notificationIDToRemove = 2;
      expect(
        notificationsReducer([testNotification_1, testNotification_2, testNotification_3],
          {
            type: types.REMOVE_NOTIFICATION,
            payload: notificationIDToRemove,
          }
        )
      ).toEqual(
        [testNotification_1, testNotification_3]
      )
    });
  });
});

