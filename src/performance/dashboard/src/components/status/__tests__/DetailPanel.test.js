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

import reducers from '../../../store/reducers/index';
import * as Constants from '../Constants';
import * as DataProjectInfo from '../../../tests/data/ProjectInfo';
import DetailPanel from '../DetailPanel';


// Constants
const STRING_TEXT = "Just some text"

// Initialize redux stores
const store = createStore(reducers, {});

// initialize component props
const componentProps = {
    show: false,
    messageText: STRING_TEXT,
    detailSubComponent: Constants.MESSAGE_COMPONENT_SIMPLE,
}

// component to render
const wrapper = (
  <Provider store={store}>
    <DetailPanel {...componentProps} />
  </Provider>
)

// do not leak state
afterEach(cleanup);

/**
 * Test functionality of the DetailPanel
 */
describe('<DetailPanel />', () => {
    test('panel displays without error', async () => {
        const {getByText} = render(wrapper);
        expect(document.querySelectorAll('.DetailsPanel').length).toBe(1);
    });

    describe('Subcomponent render types', () => {

      test('panel displays with basic HTML', async () => {
        const {getByText} = render(wrapper);
        expect(document.querySelectorAll('.DetailsPanel').length).toBe(1);
      });

      test('panel displays with the "Disable Authentication" panel', async () => {
        const {getByLabelText, rerender} = render(wrapper);
        const newProps = {
          show: true,
          messageText: STRING_TEXT,
          detailSubComponent: Constants.MESSAGE_COMPONENT_LIVEMETRICS_MICROPROFILE_DISABLE_AUTH,
          projectID: DataProjectInfo.projectInfo.projectID,
        }
        const wrapper_withUpdatedProps = (
          <Provider store={store}>
            <DetailPanel {...newProps} />
          </Provider>
        );
        rerender(wrapper_withUpdatedProps);
        await waitForElement(() => getByLabelText('Allow anonymous connections'));
      });

      test('panel displays with the "Enable Authentication" panel', async () => {
        const {getByLabelText, rerender} = render(wrapper);
        const newProps = {
          show: true,
          messageText: "",
          detailSubComponent: Constants.MESSAGE_COMPONENT_LIVEMETRICS_MICROPROFILE_ENABLE_AUTH,
          projectID: DataProjectInfo.projectInfo.projectID,
        }

        const wrapper_withUpdatedProps = (
          <Provider store={store}>
            <DetailPanel {...newProps} />
          </Provider>
        );

        rerender(wrapper_withUpdatedProps);
        await waitForElement(() => getByLabelText('Secure metrics endpoint'));
      });

      test('panel opens but does not display any sub components when none are required', async () => {
        const {getByLabelText, rerender} = render(wrapper);
        const newProps = {
          show: false,
          messageText: "",
          projectID: DataProjectInfo.projectInfo.projectID,
          detailSubComponent: "UNKNOWN",
        }
        const wrapper_withUpdatedProps = (
          <Provider store={store}>
            <DetailPanel {...newProps} />
          </Provider>
        );
        rerender(wrapper_withUpdatedProps);
        expect(document.querySelectorAll('.detailBody').length).toBe(1);
        expect(document.querySelector('.detailBody').innerHTML).toBe("");
      });


    });
});

