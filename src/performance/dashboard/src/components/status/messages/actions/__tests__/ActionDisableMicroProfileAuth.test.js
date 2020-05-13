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
import { render, cleanup, fireEvent, waitForElement } from '@testing-library/react';
import ActionDisableMicroProfileAuth from '../ActionDisableMicroProfileAuth';

// initialize component props
const componentProps = {
  projectID: '4a8ccb90-7887-11e9-b7bb-6fc798faec9b'
}

// InlineHTML component to render
const wrapper = (
  <ActionDisableMicroProfileAuth {...componentProps} />
)

// do not leak state
afterEach(cleanup);

// Mute console log warnings
//console.error = () => { }

// constants

/**
 * Test functionality of the ActionDisableMicroProfileAuth dialog
 */
describe('<ActionDisableMicroProfileAuth />', () => {
  test('component renders without crashing', () => {
    render(wrapper);
    expect(document.querySelectorAll('.ActionButton').length).toBe(1);
  });

  test('ActionButton sends a valid request to API and displays accepted', async () => {
    const { getByLabelText, container, getByText } = render(wrapper);
    const button = getByLabelText('Disable Authentication');
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve, reject) => {
        resolve({
          status:202
        });
      });
    });
    fireEvent.click(button);
    await waitForElement(() => getByText('Accepted'));
    expect(document.querySelectorAll('.bx--inline-loading__checkmark').length).toBe(1);
  });

  test('ActionButton sends an invalid request to API and displays a warning', async () => {
    const { getByLabelText, container, getByText } = render(wrapper);
    const button = getByLabelText('Disable Authentication');
    global.fetch = jest.fn().mockImplementationOnce(() => {
      return new Promise((resolve, reject) => {
        resolve({
          status:404,
          statusText: "Not found"
        });
      });
    });
    fireEvent.click(button);
    await waitForElement(() => getByText("HTTP 404 : Not found"));
    expect(document.querySelectorAll('.errorMessage').length).toBe(1);
  });

});

