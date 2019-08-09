/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
*******************************************************************************/

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import ResultsCard_Blank from '../ResultsCard_Blank';

// initialize component props
const componentProps = {
    title: "ComponentTestTitle"
}

// component to render
const wrapper = (
    <ResultsCard_Blank {...componentProps} />
)

// dont leak state
afterEach(cleanup);

// run tests
describe('<ResultsCard_Blank />', () => {
    test('component renders without crashing', () => {
        const { container } = render(wrapper);
        expect(container.querySelector('.ResultsCardBlank').className).toBe('ResultsCardBlank');
    });

    test('props can set the component title', () => {
        const { container } = render(wrapper);
        expect(container.querySelector('.label').innerHTML).toBe(componentProps.title);
    });
});