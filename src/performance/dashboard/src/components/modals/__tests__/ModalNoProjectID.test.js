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
import { render, cleanup } from '@testing-library/react';

import  ModalNoProjectID from '../ModalNoProjectID';

// component to render
const wrapper = (
        <ModalNoProjectID /> 
)

// dont leak state
afterEach(cleanup);

// run test
describe('<ModalNoProjectID />', () => {
    test('dialog displays without error',() => {
        render( wrapper )
        expect(document.querySelector('#RegressionTestNoID.bx--modal').id).toBe('RegressionTestNoID');
    });

    test('has a valid heading',() => {
        render( wrapper )
        expect(document.querySelector('#RegressionTestNoID .bx--modal-header__heading').innerHTML).toBe('Missing Project ID');
    });

});


