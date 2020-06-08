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

import React from 'react';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { render, cleanup, waitForElement } from '@testing-library/react';

import reducers from '../../../../store/reducers/index';
import * as DataProjectInfo from '../../../../tests/data/ProjectInfo';
import * as ProjectCapabilitiesInfo from '../../../../tests/data/ProjectCapabilitiesInfo';
import MPEnableAuth from '../MPEnableAuth';

// initialize component props
const componentProps = {
    projectID: DataProjectInfo.projectInfo.projectID,
}

// Initialize redux stores
const store = createStore(reducers, {
  projectCapabilitiesReducer: { config: ProjectCapabilitiesInfo.capabilitiesData, receivedAt: Date.now(), fetched: true }
});

// component to render
const wrapper = (
    <Provider store={store}>
        <MPEnableAuth {...componentProps} />
    </Provider>
)

// do not leak state
afterEach(cleanup);

// Mute console log warnings
console.log = () => { }

// constants

/**s
 * Test functionality of the MPEnableAuth panel
 */
describe('<MPEnableAuth />', () => {
    test('panel displays without error', () => {
        render(wrapper);
        expect(document.querySelectorAll('.MPEnableAuth').length).toBe(1);
    });

    test('renders the welcome label', async () => {
      const { getByText } = render(wrapper);
      await waitForElement(() => getByText('You can secure the metrics endpoint in your project by blocking anonymous access here:'));
    });

    test('renders the disable anonymous access action button', async () => {
        const { getByLabelText } = render(wrapper);
        await waitForElement(() => getByLabelText("Secure metrics endpoint"));
    });
});
