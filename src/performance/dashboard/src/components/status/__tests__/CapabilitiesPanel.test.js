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
import { render, cleanup, fireEvent } from '@testing-library/react';

import reducers from '../../../store/reducers/index';
import * as DataProjectInfo from '../../../tests/data/ProjectInfo';
import * as ProjectCapabilitiesInfo from '../../../tests/data/ProjectCapabilitiesInfo';
import CapabilitiesPanel from '../CapabilitiesPanel';

// initialize component props
const componentProps = {
    projectID: DataProjectInfo.projectInfo.projectID,
    handleCapabilitiesClose: jest.fn()
}

// Initialize redux stores
const store = createStore(reducers, {
  projectCapabilitiesReducer: { config: ProjectCapabilitiesInfo.capabilitiesData, receivedAt: Date.now(), fetched: true }
});

// component to render
const wrapper = (
    <Provider store={store}>
        <CapabilitiesPanel {...componentProps} />
    </Provider>
)

// do not leak state
afterEach(cleanup);

// Mute console log warnings
console.log = () => { }

// constants

/**s
 * Test functionality of the ModelRunTest dialog
 */
describe('<CapabilitiesPanel />', () => {
    test('panel displays without error', () => {
        render(wrapper);
        expect(document.querySelectorAll('.Capabilities').length).toBe(1);
    });


    describe('Status message card tests', () => {
        describe('ProjectStatus card rendering', () => {
            test('"ProjectStatus" card #1 exists', () => {
                render(wrapper);
                expect(document.querySelector('.rows .row:nth-of-type(1) .capability').innerHTML).toEqual("Project Status");
                expect(document.querySelector('.rows .row:nth-of-type(1) .description').innerHTML).toEqual("Unable to determine status");
            });
        });

        describe('LoadRunner card rendering', () => {
            test('"LoadRunner" card #2 exists', () => {
                render(wrapper);
                expect(document.querySelector('.rows .row:nth-of-type(2) .capability').innerHTML).toEqual("Run Load Feature");
                expect(document.querySelector('.rows .row:nth-of-type(2) .description').innerHTML).toEqual("Unable to determine status");
            });
        });

        describe('LiveMetrics card rendering', () => {
            test('"LiveMetrics" card #3 exists', () => {
                render(wrapper);
                expect(document.querySelector('.rows .row:nth-of-type(3) .capability').innerHTML).toEqual("Live Monitoring");
                expect(document.querySelector('.rows .row:nth-of-type(3) .description').innerHTML).toEqual("Unable to determine status");
            });
        });

        describe('TestComparisons card rendering', () => {
            test('"TestComparisons" card #4 exists', () => {
                render(wrapper);
                expect(document.querySelector('.rows .row:nth-of-type(4) .capability').innerHTML).toEqual("Benchmarks");
                expect(document.querySelector('.rows .row:nth-of-type(4) .description').innerHTML).toEqual("Unable to determine status");
            });
        });
    });
});

