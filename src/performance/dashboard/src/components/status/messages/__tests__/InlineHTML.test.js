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
import { render, cleanup } from '@testing-library/react';

import InlineHTML from '../InlineHTML';

const test_text = "this is some text"
const test_markup= `<div class="MyClass">${test_text}</div>`;
const test_markup_invalid = `<brokenTag class="MyClass">${test_text}</unclosedTag>`;

// initialize component props
const componentProps = {
  markup: test_markup
}

// InlineHTML component to render
const wrapper = (
  <InlineHTML {...componentProps} />
)

// do not leak state
afterEach(cleanup);

// Mute console log warnings
console.log = () => { }

// constants

/**
 * Test functionality of the ModelRunTest dialog
 */
describe('<InlineHTML />', () => {
    test('component renders without crashing', () => {
        render(wrapper);
        expect(document.querySelectorAll('.InlineHTML').length).toBe(1);
    });

    test('component renders test_markup_text markup once', () => {
      render(wrapper);
      expect(document.querySelectorAll('.InlineHTML .MyClass').length).toBe(1);
    });

    test('component displays rendered text', async () => {
      const { getByText, findByText } =  render(wrapper);
      const node = await findByText(test_text)
      expect(node.getAttribute('class')).toBe("MyClass");
    });

    test('component renders invalid markup without crashing', async () => {
      const componentPropsInvalid = {
        markup: test_markup_invalid
      }
      const wrapperInvalid = (
        <InlineHTML {...componentPropsInvalid} />
      )
      const { getByText, findByText } =  render(wrapperInvalid);
      const node = await findByText(test_text)
      expect(node.getAttribute('class')).toBe("MyClass");
    });

});

