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
import { render, cleanup, fireEvent } from '@testing-library/react';

import reducers from '../../../store/reducers/index';
import * as DataProjectInfo from '../../../tests/data/ProjectInfo';
import ModalRunTest from '../ModalRunTest';

// initialize component props
const componentProps = {
    handleRunTestDlgClose: jest.fn(),
    handleRunTestDlgStart: jest.fn()
}

// Initialize redux stores
const store = createStore(reducers, {
    projectInfoReducer: { config: DataProjectInfo.projectInfo, receivedAt: Date.now(), fetched: true }
});

// component to render
const wrapper = (
    <Provider store={store}>
        <ModalRunTest {...componentProps} />
    </Provider>
)

// dont leak state
afterEach(cleanup);

// constants
const TEST_DESCRIPTION = "A short description describing the test"
const MAX_DESCRIPTION_LENGTH = 80;

/** 
 * Test functionality of the ModelRunTest dialog
 */
describe('<ModalRunTest />', () => {
    test('dialog displays without error', () => {
        render(wrapper);
        expect(document.querySelector('#ModalRunTest.bx--modal').id).toBe('ModalRunTest');
    });

    test('modal has a valid heading', () => {
        render(wrapper);
        expect(document.querySelector('#ModalRunTest .bx--modal-header__heading').innerHTML).toBe('Load test configuration');
    });

    describe('Test modal button status', () => {
        test('there is an active cancel button ', () => {
            const { getByText } = render(wrapper);
            const cancelButton = getByText('Cancel');
            expect(cancelButton.disabled).toEqual(false)
        })

        test('there is an active submit button ', () => {
            const { getByText } = render(wrapper);
            const submitButton = getByText('Run');
            expect(submitButton.disabled).toEqual(false)
        })
    });

    describe('Test comment field', () => {
        test('there is an input textarea field', () => {
            render(wrapper);
            expect(document.querySelector('#ModalRunTest textarea').placeholder).toBe('Describe this new test');
        });

        test('the textarea is empty by default', () => {
            render(wrapper);
            expect(document.querySelector('.charCounter').innerHTML).toBe(`0 / ${MAX_DESCRIPTION_LENGTH}`);
        });

        test('the textarea can receive input and updates character count', () => {
            const { getByPlaceholderText } = render(wrapper);
            const textAreaField = getByPlaceholderText(/Describe this new test/i);
            fireEvent.input(textAreaField, { target: { value: TEST_DESCRIPTION } });
            expect(textAreaField.value).toEqual(TEST_DESCRIPTION);
            expect(document.querySelector('.charCounter').innerHTML).toBe(`${TEST_DESCRIPTION.length} / ${MAX_DESCRIPTION_LENGTH}`);
        });

        test(`textarea rejects over ${MAX_DESCRIPTION_LENGTH} characters from being typed/pasted`, () => {
            const TEST_DESCRIPTION = "a".repeat(MAX_DESCRIPTION_LENGTH + 1);
            const { getByPlaceholderText } = render(wrapper);
            const textAreaField = getByPlaceholderText(/Describe this new test/i);
            fireEvent.input(textAreaField, { target: { value: TEST_DESCRIPTION } });
            expect(document.querySelector('.charCounter').innerHTML).toBe(`0 / ${MAX_DESCRIPTION_LENGTH}`);
        });
    
    });

    describe('Test input text size indicator', () => {

        test(`counter warning appears after ${MAX_DESCRIPTION_LENGTH-9} characters typed`, () => {
            const TEST_DESCRIPTION = "a".repeat(MAX_DESCRIPTION_LENGTH - 9);
            const { getByPlaceholderText } = render(wrapper);
            const textAreaField = getByPlaceholderText(/Describe this new test/i);
            fireEvent.input(textAreaField, { target: { value: TEST_DESCRIPTION } });
            expect(document.querySelector('.charCounter').classList).toContain("warning");
        });

        test(`counter almost full warning appears after ${MAX_DESCRIPTION_LENGTH-7} characters typed`, () => {
            const TEST_DESCRIPTION = "a".repeat(MAX_DESCRIPTION_LENGTH - 7);
            const { getByPlaceholderText } = render(wrapper);
            const textAreaField = getByPlaceholderText(/Describe this new test/i);
            fireEvent.input(textAreaField, { target: { value: TEST_DESCRIPTION } });
            expect(document.querySelector('.charCounter').classList).toContain("danger");
        });
    });

    describe('Test dialog closes', () => {
        test('dialog closes when the "cancel" button is clicked', () => {
            const { getByText } = render(wrapper);
            const cancelButton = getByText('Cancel');
            fireEvent.click(cancelButton);
            const onClickFunction = componentProps.handleRunTestDlgClose;
            expect(onClickFunction).toHaveBeenCalled();
        });

        test('dialog closes when the "run" button is clicked', () => {
            const { getByText } = render(wrapper);
            const runButton = getByText('Run');
            fireEvent.click(runButton);
            const onClickFunction = componentProps.handleRunTestDlgStart;
            expect(onClickFunction).toHaveBeenCalled();
        });
    });

});

