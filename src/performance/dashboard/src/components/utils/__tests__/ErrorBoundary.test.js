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

import React, {Fragment} from 'react';
import { render, cleanup, waitForElement } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';
import ComponentWithAnError from '../../../tests/components/ComponentWithAnError';

// component to render
const componentWithoutAnError = (
    <ErrorBoundary>
        <div className="label">We are fine</div>
    </ErrorBoundary>
  )

  const componentWithAnError = (
    <Fragment>
        <ErrorBoundary>
            <ComponentWithAnError/>
        </ErrorBoundary>
    </Fragment>
  )

// do not leak state
afterEach(cleanup);

// Mute console error because we will generate a forced exception
console.error = () => { }

/**s
 * Test functionality of the ErrorBoundary dialog
 */
describe('<ErrorBoundary />', () => {
    test('ErrorBoundary renders valid child components without an error', async () => {
        const {getByText} = render(componentWithoutAnError);
        await waitForElement(() => getByText('We are fine'));
    });

    test('ErrorBoundary catches a component error and displays a red "Unable to render" without crashing', async () => {
        const {getByText} = render(componentWithAnError);
        const element = await waitForElement(() => getByText('Unable to render'));
        expect(element.style.color).toBe('red');
    });

});

