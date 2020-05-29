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
import { createStore, applyMiddleware  } from 'redux';
import { Provider} from 'react-redux';
import { render, cleanup, fireEvent } from '@testing-library/react';
import thunk from 'redux-thunk';

import reducers from '../../../store/reducers/index';
import * as DataProjectInfo from '../../../tests/data/ProjectInfo';
import * as LoadRunnerConfig from '../../../tests/data/LoadRunnerConfig';
import ModalModifyLoadTests from '../ModalModifyLoadTests';

// initialize component props
const componentProps = {
    projectID: DataProjectInfo.projectInfo.projectID,
    open: true,
    closeModalWindow: jest.fn(),
}

// Initialize redux stores
const store = createStore(reducers, {
    projectInfoReducer: { config: DataProjectInfo.projectInfo, receivedAt: Date.now(), fetched: true },
    loadRunnerConfigReducer: { config: LoadRunnerConfig.projectLoadRunnerConfig, receivedAt: Date.now(), fetched: true }
}, applyMiddleware(thunk));

// component to render
const wrapper = (
    <Provider store={store}>
        <ModalModifyLoadTests {...componentProps} />
    </Provider>
)

// Mute modal dataIconPath warnings
console.error = () => { }

// dont leak state
afterEach(cleanup);

/**
 * Test functionality of the ModalModifyLoadTests dialog
 */
describe('<ModalModifyLoadTests />', () => {
    test('dialog renders without crashing', () => {
        render(wrapper);
        expect(document.querySelector('.ModalModifyLoadTest').className).toContain("bx--modal");
    });

    test('modal has a valid heading', () => {
        render(wrapper);
        expect(document.querySelector('.ModalModifyLoadTest .bx--modal-header__heading').innerHTML).toBe('Load test configuration');
    });

    describe('Tests inputs on method dropdown field', () => {
        test('the modal dialog has a method dropdown field', () => {
            const { container } = render(wrapper);
            const selectedItem = container.querySelectorAll('#method .bx--list-box__field span');
            expect(selectedItem.length).toBe(1);
        });

        test('the dropdown has exactly 2 selectable menu choices', () => {
            const { container } = render(wrapper);
            const dropDown = container.querySelector('#method .bx--list-box__field');
            fireEvent.click(dropDown);
            expect(document.querySelectorAll('#method  .bx--list-box__menu-item__option').length).toBe(2);
        });

        test('selecting GET and POST updates the state', () => {
            const { container } = render(wrapper);
            const selectedItem = document.querySelector('#method .bx--list-box__field span');
            const dropDown = container.querySelector('#method .bx--list-box__field');
            fireEvent.click(dropDown);

            const OPTION_GET = document.querySelectorAll('#method  .bx--list-box__menu-item__option')[0];
            expect(OPTION_GET.textContent).toBe("GET");
            fireEvent.click(OPTION_GET);
            expect(selectedItem.textContent).toBe("GET");

            fireEvent.click(dropDown);
            const OPTION_POST = document.querySelectorAll('#method  .bx--list-box__menu-item__option')[1];
            expect(OPTION_POST.textContent).toBe("POST");
            fireEvent.click(OPTION_POST);
            expect(selectedItem.textContent).toBe("POST");
        });
    });

    describe('Tests inputs on path field', () => {
        test('the dialog has a path field that accepts a valid input', () => {
            const sampleFieldValue = '/rootedPath';
            const { getByPlaceholderText, getByText } = render(wrapper);
            const textField = getByPlaceholderText(/eg: \/myapi/i);
            fireEvent.input(textField, { target: { value: sampleFieldValue } });
            expect(textField.value).toEqual(sampleFieldValue);
            expect(textField.getAttribute("aria-invalid")).toBeNull();
            expect(document.querySelector('#path-error-msg')).toBeNull();
        });

        test('the dialog has a path field rejects invalid input', () => {
            const sampleFieldValue = 'nonRootedPath';
            const { getByPlaceholderText, getByText } = render(wrapper);
            const textField = getByPlaceholderText(/eg: \/myapi/i);
            fireEvent.input(textField, { target: { value: sampleFieldValue } });
            expect(textField.value).toEqual(sampleFieldValue);
            expect(textField.getAttribute("aria-invalid")).toBe("true");
            expect(document.querySelector('#path-error-msg').innerHTML).toBe('Must contain a valid path eg: /');
        });
    });

    describe('Tests inputs on requestsPerSecond field', () => {
        test('the dialog has a requestsPerSecond field that accepts a valid input', () => {
            const sampleFieldValue = '30';
            const { getByPlaceholderText } = render(wrapper);
            const textField = getByPlaceholderText(/Requests per second eg: 30/i);
            fireEvent.input(textField, { target: { value: sampleFieldValue } });
            expect(textField.value).toEqual(sampleFieldValue);
            expect(textField.getAttribute("aria-invalid")).toBeNull();
            expect(document.querySelector('#requestsPerSecond-error-msg')).toBeNull();
        });

        test('the requestsPerSecond field rejects invalid input', () => {
            const sampleFieldValue = '999999';
            const { getByPlaceholderText } = render(wrapper);
            const textField = getByPlaceholderText(/Requests per second eg: 30/i);
            fireEvent.input(textField, { target: { value: sampleFieldValue } });
            expect(textField.value).toEqual(sampleFieldValue);
            expect(textField.getAttribute("aria-invalid")).toBe("true");
            expect(document.querySelector('#requestsPerSecond-error-msg').innerHTML).toBe('Must be an integer between 1 and 3600');
        });
    });

    describe('Tests inputs on concurrency field', () => {
        test('the dialog has a concurrency field that accepts a valid input', () => {
            const sampleFieldValue = '30';
            const { getByPlaceholderText } = render(wrapper);
            const textField = getByPlaceholderText(/Concurrent threads/i);
            fireEvent.input(textField, { target: { value: sampleFieldValue } });
            expect(textField.value).toEqual(sampleFieldValue);
            expect(textField.getAttribute("aria-invalid")).toBeNull();
            expect(document.querySelector('#concurrency-error-msg')).toBeNull();
        })

        test('the concurrency field rejects invalid input', () => {
            const sampleFieldValue = '0';
            const { getByPlaceholderText } = render(wrapper);
            const textField = getByPlaceholderText(/Concurrent threads/i);
            fireEvent.input(textField, { target: { value: sampleFieldValue } });
            expect(textField.value).toEqual(sampleFieldValue);
            expect(textField.getAttribute("aria-invalid")).toBe("true");
            expect(document.querySelector('#concurrency-error-msg').innerHTML).toBe('Must be an integer between 1 and 100');
        })
    });

    describe('Tests inputs on duration field', () => {
        test('the dialog has a duration field that accepts a valid input', () => {
            const sampleFieldValue = '30';
            const { getByPlaceholderText } = render(wrapper);
            const textField = getByPlaceholderText(/Test run duration/i);
            fireEvent.input(textField, { target: { value: sampleFieldValue } });
            expect(textField.value).toEqual(sampleFieldValue);
            expect(textField.getAttribute("aria-invalid")).toBeNull();
            expect(document.querySelector('#maxSeconds-error-msg')).toBeNull();
        })

        test('the duration field rejects invalid input', () => {
            const sampleFieldValue = '0';
            const { getByPlaceholderText } = render(wrapper);
            const textField = getByPlaceholderText(/Test run duration/i);
            fireEvent.input(textField, { target: { value: sampleFieldValue } });
            expect(textField.value).toEqual(sampleFieldValue);
            expect(textField.getAttribute("aria-invalid")).toBe("true");
            expect(document.querySelector('#maxSeconds-error-msg').innerHTML).toBe('Must be an integer between 10 and 500');
        });
    });

    describe('Tests inputs on body field', () => {
        test('the dialog has a body field that accepts a valid json', () => {
            const sampleFieldValue = '{"field1":"test1", "field2":"test2"}';
            const { getByPlaceholderText } = render(wrapper);
            const textField = getByPlaceholderText(/{"id": 1, "message":"hello"}/i);
            fireEvent.input(textField, { target: { value: sampleFieldValue } });
            expect(textField.value).toEqual(sampleFieldValue);
            expect(textField.getAttribute("aria-invalid")).toBeNull();
            expect(document.querySelector('#body-error-msg')).toBeNull();
        });

        test('the body field rejects invalid json', () => {
            const invalidJSONPayload = '{"field1"::::::::"test1",,,,,,"field2":"test2"}';
            const { getByPlaceholderText } = render(wrapper);
            const textField = getByPlaceholderText(/{"id": 1, "message":"hello"}/i);
            fireEvent.input(textField, { target: { value: invalidJSONPayload } });
            expect(textField.value).toEqual(invalidJSONPayload);
            expect(textField.getAttribute("aria-invalid")).toBe("true");
            expect(document.querySelector('#body-error-msg').innerHTML).toBe('SyntaxError: Unexpected token : in JSON at position 10');
        });
    });

    describe('Test dialog button status', () => {
        test('there is an active cancel button', () => {
            const { getByText } = render(wrapper);
            const cancelButton = getByText('Cancel');
            expect(cancelButton.disabled).toEqual(false);
        });

        test('there is a disabled submit button on initial load', () => {
            const { getByText } = render(wrapper);
            const submitButton = getByText('Save');
            expect(submitButton.disabled).toEqual(true);
        });

        test('submit button is enabled when all fields are populated correctly', () => {
            const { getByText, getByPlaceholderText } = render(wrapper);
            fireEvent.input(document.querySelector("#method"), { target: { selectedItem: { id: 'GET', text: 'GET' } } });
            fireEvent.input(getByPlaceholderText(/eg: \/myapi/i), { target: { value: '/rootedPath' } });
            fireEvent.input(getByPlaceholderText(/Requests per second eg: 30/i), { target: { value: '30' } });
            fireEvent.input(getByPlaceholderText(/Concurrent threads/i), { target: { value: '30' } });
            fireEvent.input(getByPlaceholderText(/Test run duration/i), { target: { value: '30' } });
            fireEvent.input(getByPlaceholderText(/{"id": 1, "message":"hello"}/i), { target: { value: '{"field1":"test1", "field2":"test2"}' } });
            const submitButton = getByText('Save');
            expect(submitButton.disabled).toEqual(false);
        });
    });

    describe('Test dialog button actions', () => {
        test('calls dialog close when the "close" button is clicked', () => {
            const { getByText } = render(wrapper);
            const cancelButton = getByText('Cancel');
            fireEvent.click(cancelButton);
            const onClickFunction = componentProps.closeModalWindow;
            expect(onClickFunction).toHaveBeenCalled();
        });

        test('calls dialog close when the "cancel" button is clicked', () => {
            const { container } = render(wrapper);
            const closeButton = container.querySelector('.bx--btn--secondary');
            fireEvent.click(closeButton);
            const onClickFunction = componentProps.closeModalWindow;
            expect(onClickFunction).toHaveBeenCalled();
        });

        test('clicking save xposts to the API and updates local stores', () => {
            // Mock response from API
            global.fetch = jest.fn().mockImplementation(() => {
                return new Promise((resolve, reject) => {
                    resolve({});
                });
            });

            const { container, getByText, getByPlaceholderText } = render(wrapper);
            // CHOOSE POST
            const dropDown = container.querySelector('#method .bx--list-box__field');
            fireEvent.click(dropDown);
            const OPTION_POST = document.querySelectorAll('#method  .bx--list-box__menu-item__option')[1];
            expect(OPTION_POST.textContent).toBe("POST");
            fireEvent.click(OPTION_POST);

            fireEvent.input(document.querySelector("#method"), { target: { selectedItem: { id: 'POST', text: 'POST' } } });
            fireEvent.input(getByPlaceholderText(/eg: \/myapi/i), { target: { value: '/rootedPath' } });
            fireEvent.input(getByPlaceholderText(/Requests per second eg: 30/i), { target: { value: '30' } });
            fireEvent.input(getByPlaceholderText(/Concurrent threads/i), { target: { value: '40' } });
            fireEvent.input(getByPlaceholderText(/Test run duration/i), { target: { value: '50' } });
            fireEvent.input(getByPlaceholderText(/{"id": 1, "message":"hello"}/i), { target: { value: '{"field1":"test1", "field2":"test2"}' } });
            const saveButton = getByText('Save');

            // Check initial values in store before being saved
            expect(store.getState().loadRunnerConfigReducer.config.method).toBe('GET');
            expect(store.getState().loadRunnerConfigReducer.config.path).toBe('/');
            expect(store.getState().loadRunnerConfigReducer.config.requestsPerSecond).toBe('100');
            expect(store.getState().loadRunnerConfigReducer.config.concurrency).toBe('20');
            expect(store.getState().loadRunnerConfigReducer.config.maxSeconds).toBe('180');

            fireEvent.click(saveButton);
            expect(store.getState().loadRunnerConfigReducer.fetched).toBe(true);
            expect(store.getState().loadRunnerConfigReducer.config.method).toBe('POST');
            expect(store.getState().loadRunnerConfigReducer.config.path).toBe('/rootedPath');
            expect(store.getState().loadRunnerConfigReducer.config.requestsPerSecond).toBe('30');
            expect(store.getState().loadRunnerConfigReducer.config.concurrency).toBe('40');
            expect(store.getState().loadRunnerConfigReducer.config.maxSeconds).toBe('50');
            expect(componentProps.closeModalWindow).toHaveBeenCalled();
        });
    });
});
