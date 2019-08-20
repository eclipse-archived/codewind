/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
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
import NavBar from '../NavBar';
import reducers from '../../../store/reducers/index';
import * as DataProjectInfo from '../../../tests/data/ProjectInfo';

// initialize component props
const componentProps = {
    projectID: DataProjectInfo.projectInfo.projectID
}

// initialize redux stores
const store = createStore(reducers, {
    projectInfoReducer: { config: DataProjectInfo.projectInfo, receivedAt: Date.now(), fetched: true }
});

// component to render
const wrapper = (
    <Provider store={store}>
        <NavBar {...componentProps} />
    </Provider>
)

// dont leak state
afterEach(cleanup);

// run test
describe('<NavBar />', () => {

    test('has the correct branding title', () => {
        render(wrapper)
        expect(document.querySelector('.appTitle_1').innerHTML).toBe('code');
        expect(document.querySelector('.appTitle_2').innerHTML).toBe('wind');
    });

    test('displays the correct project name', () => {
        render(wrapper)
        expect(document.querySelector('.projectName').innerHTML).toBe('SampleProjectName');
    });

    it('updates project name on a props change when it is different to current value', () => {
        const CONST_NEW_PROJECT_NAME = 'ProjectNameHasChanged'
        const { rerender, container } = render(wrapper);
        const projectInfo = DataProjectInfo.projectInfo;
        projectInfo.name = CONST_NEW_PROJECT_NAME;

        const wrapper_withUpdatedProps_Undefined = (
            <Provider store={store}>
                <NavBar {...componentProps} projectInfo={undefined} />
            </Provider>
        );
        rerender(wrapper_withUpdatedProps_Undefined);
        expect(container.querySelector('.projectName').innerHTML).toBe(CONST_NEW_PROJECT_NAME);

        const wrapper_withUpdatedProps = (
            <Provider store={store}>
                <NavBar {...componentProps} projectInfo={projectInfo} />
            </Provider>
        );
        rerender(wrapper_withUpdatedProps);
        expect(container.querySelector('.projectName').innerHTML).toBe(CONST_NEW_PROJECT_NAME);
    });

});
