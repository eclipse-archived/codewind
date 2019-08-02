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
import  NavBar from '../NavBar';
import reducers from '../../../store/reducers/index';
import * as DataProjectInfo from '../../../tests/data/ProjectInfo';

// initialise component props
const componentProps = {
    projectID:  DataProjectInfo.projectInfo.projectID
}

// Initialise redux stores
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
    
    test('has the correct branding title',() => {
        render( wrapper )
        expect(document.querySelector('.appTitle_1').innerHTML).toBe('code');
        expect(document.querySelector('.appTitle_2').innerHTML).toBe('wind');
    });

    test('displays the correct project name',() => {
        render( wrapper )
        expect(document.querySelector('.projectName').innerHTML).toBe('SampleProjectName');
    });

});


