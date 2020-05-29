/*******************************************************************************
* Copyright (c) 2020 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
********************************************************************************/

import React from 'react';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import reducers from '../../../../../store/reducers/index';
import { render, cleanup, fireEvent, waitForElement, waitForElementToBeRemoved } from '@testing-library/react';
import ActionEnableMicroProfileAuth from '../ActionEnableMicroProfileAuth';

// initialize component props
const componentProps = {
  projectID: '4a8ccb90-7887-11e9-b7bb-6fc798faec9b'
}

// Initialize redux stores
const store = createStore(reducers, {});

// InlineHTML component to render
const wrapper = (
  <Provider store={store}>
    <ActionEnableMicroProfileAuth {...componentProps} />
  </Provider>
)

// do not leak state
afterEach(cleanup);

/**
 * Test functionality of the ActionEnableMicroProfileAuth dialog
 */
describe('<ActionEnableMicroProfileAuth />', () => {
  test('component renders without crashing', () => {
    render(wrapper);
    expect(document.querySelectorAll('.ActionButton').length).toBe(1);
  });

  test('ActionButton sends a valid request to API and displays accepted', async () => {
    const { getByLabelText, container, getByText } = render(wrapper);
    const button = getByLabelText('Secure metrics endpoint');
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve, reject) => {
        resolve({
          status:202
        });
      });
    });
    fireEvent.click(button);
    await waitForElement(() => getByText('Requesting'));
    await waitForElement(() => getByText('Accepted'));
    expect(document.querySelectorAll('.bx--inline-loading__checkmark').length).toBe(1);
    await waitForElementToBeRemoved(() => getByText('Accepted'));
  });

  test('ActionButton sends an invalid request to API and displays a 404 error', async () => {
    const { getByLabelText, getByText } = render(wrapper);
    const button = getByLabelText('Secure metrics endpoint');
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve, reject) => {
        resolve({
          status:404,
          statusText: "Not found"
        });
      });
    });
    fireEvent.click(button);
    await waitForElement(() => getByText('Requesting'));
    await waitForElement(() => getByText("HTTP 404 : Not found"));
    expect(document.querySelectorAll('.errorMessage').length).toBe(1);
  });
});
