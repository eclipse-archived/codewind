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
import { render, cleanup } from '@testing-library/react';

import ModalBlocker from '../ModalBlocker';

// initialize component props
const componentProps = {
    active: true
}


// component to render
const wrapper = (
    <ModalBlocker {...componentProps}/>
)

// Mute modal dataIconPath warnings
console.error = () => { }

// dont leak state
afterEach(cleanup);

// run test
describe('<ModalBlocker />', () => {
    test('dialog displays without error', () => {
        render(wrapper)
        expect(document.querySelector('#CodewindDisconnected.bx--modal').id).toBe('CodewindDisconnected');
    });

    test('has a valid heading', () => {
        render(wrapper)
        expect(document.querySelector('#CodewindDisconnected .bx--modal-header__heading').innerHTML).toBe('Dashboard Offline');
    });
});


