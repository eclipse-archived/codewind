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

import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import ProjectIDChecker from '../../utils/projectUtils';
import { reloadMetricsData } from '../../store/actions/projectMetricsActions';
import { connect } from 'react-redux';
import { Modal, TextInput, TextInputSkeleton, TextArea, Dropdown } from 'carbon-components-react';
import { fetchProjectLoadConfig, saveProjectLoadConfig } from '../../store/actions/loadRunnerConfigActions';
import { TESTRUN_MAX_REQUEST_PER_SEC, TESTRUN_MAX_CONCURRENT, TESTRUN_MAX_DURATION } from '../../AppConstants';
import * as AppConstants from '../../AppConstants';

import './ModalModifyLoadTests.scss';

class ModalModifyLoadTests extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            saveInProgress: false,
            loadingData: false,
            dialogStateOpen: false,
            modalErrorText: '',
            formFields: {
                method: '',
                body: '',
                path: '',
                requestsPerSecond: '',
                concurrency: '',
                maxSeconds: '',
            }
        }
        this.validateFieldPath = this.validateFieldPath.bind(this);
        this.validateIntegerField = this.validateIntegerField.bind(this);
        this.handleDialogSave = this.handleDialogSave.bind(this);
    }

    /**
     * New props provided,
     * Re-load configuration from the server if dialogbox is opening
     * @param {*} nextProps
     */
    async componentWillReceiveProps(nextProps) {
        if (nextProps.open !== this.state.dialogStateOpen) {
            this.setState({ dialogStateOpen: nextProps.open, modalErrorText: '', saveInProgress: false, loadingData: true });
            if (nextProps.open) {
                await this.props.dispatch(fetchProjectLoadConfig(localStorage.getItem("cw-access-token"), ProjectIDChecker.projectID()));
                if (this.props.loadRunnerConfig.fetched) {
                    const formFields = { ...this.props.loadRunnerConfig.config }
                    if (formFields['body']) {
                        formFields.body = JSON.stringify(formFields['body']);
                    } else {
                        formFields.body = '';
                    }
                    if (!formFields['method']) {
                        formFields.method = 'GET';
                    }
                    this.setState({ modalErrorText: "", loadingData: false, formFields: formFields });
                } else {
                    this.setState({ modalErrorText: this.props.loadRunnerConfig.error.message, loadingData: false });
                }
            }
        }
    }

    fieldValueChanged(e) {
        let formFields = this.state.formFields;
        formFields[e.target.id] = e.target.value.trim();
        this.setState({ formFields: formFields, modalErrorText: '' })
    }

    dropdownFieldValueChanged(fieldName, selectedEntry) {
        let formFields = this.state.formFields;
        formFields[fieldName] = selectedEntry.selectedItem.text;
        this.setState({ formFields: formFields, modalErrorText: '' })
    }

    validateBodyField() {
        let result = { valid: true, message: '' };
        const value = this.state.formFields["body"];
        if (value.trim().length === 0) return result;
        try {
            JSON.parse(value);
        } catch (err) {
            result = { valid: false, message: `${err}` };
        }
        return result;
    }

    validateFieldPath() {
        let result = { valid: true, message: '' };
        try {
            const path = this.state.formFields.path.trim();
            if (path.length === 0 || !path.startsWith('/')) {
                result = { valid: false, message: 'Must contain a valid path eg: /' };
            }
        } catch (err) {
            result = { valid: false, message: err };
        }
        return result;
    }

    validateIntegerField(fieldName, minInt, maxInt) {
        let result = { valid: true, message: '' };
        try {
            const value = this.state.formFields[fieldName].trim();
            const numberOnlyFilter = new RegExp('^[0-9]*$');
            const integer = parseInt(value, 10);
            if (!numberOnlyFilter.test(value) || integer < minInt || integer > maxInt) {
                result = { valid: false, message: `Must be an integer between ${minInt} and ${maxInt}` };
            }
        } catch (err) {
            result = { valid: false, message: `${err}` };
        }
        return result;
    }

    // Save form fields
    async handleDialogSave() {
        const projectID = ProjectIDChecker.projectID();

        this.setState({ saveInProgress: true });
        const newConfigPayload = {
            "method": this.state.formFields.method,
            "body": this.state.formFields.body,
            "path": this.state.formFields.path,
            "requestsPerSecond": this.state.formFields.requestsPerSecond,
            "concurrency": this.state.formFields.concurrency,
            "maxSeconds": this.state.formFields.maxSeconds
        };
        await this.props.dispatch(saveProjectLoadConfig(localStorage.getItem('cw-access-token'), projectID, newConfigPayload));

        if (!this.props.loadRunnerConfig.error && this.props.loadRunnerConfig.fetched) {
            await this.props.dispatch(reloadMetricsData(localStorage.getItem('cw-access-token'), projectID, this.props.projectMetricTypes.types));
            this.props.closeModalWindow();
        } else {
            this.setState({ modalErrorText: this.props.loadRunnerConfig.error.message, saveInProgress: false });
        }
    }

    render() {
        let { formFields, dialogStateOpen, saveInProgress, modalErrorText } = this.state;

        if (!formFields) {
            return <Fragment />
        }

        let isPathValid = this.validateFieldPath();
        let isRequestsValid = this.validateIntegerField('requestsPerSecond', 1, TESTRUN_MAX_REQUEST_PER_SEC);
        let isConcurrentValid = this.validateIntegerField('concurrency', 1, TESTRUN_MAX_CONCURRENT);
        let isDurationValid = this.validateIntegerField('maxSeconds', 10, TESTRUN_MAX_DURATION);
        let isBodyValid = this.validateBodyField();
        let isFormValid = !saveInProgress && !modalErrorText && isBodyValid.valid && isPathValid.valid && isRequestsValid.valid && isConcurrentValid.valid && isDurationValid.valid;

        return (
            <Modal
                className="ModalModifyLoadTest"
                open={dialogStateOpen}
                shouldsubmitonenter="false"
                danger={modalErrorText ? true : false}
                modalLabel=""
                modalAriaLabel="Load test configuration"
                modalHeading="Load test configuration"
                primaryButtonText="Save"
                secondaryButtonText="Cancel"
                iconDescription="Cancel"
                onRequestClose={() => this.props.closeModalWindow()}
                onRequestSubmit={() => { this.handleDialogSave() }}
                onSecondarySubmit={() => this.props.closeModalWindow()}
                primaryButtonDisabled={!isFormValid}
            >
                <div className="formFields">
                    {modalErrorText ? <Fragment /> :
                        <form autoComplete="off">
                            <table className="formTable">
                                <tbody>
                                    <tr>
                                        <td className='fieldLabel'><label>Method</label></td>
                                        <td>
                                            {this.state.loadingData ?
                                                <TextInputSkeleton hideLabel /> :
                                                <Dropdown
                                                    id="method"
                                                    light
                                                    hideLabel
                                                    label="Method"
                                                    aria-label="Method dropdown"
                                                    invalid={false}
                                                    items={AppConstants.LOADRUN_METHODS}
                                                    selectedItem={AppConstants.LOADRUN_METHODS.find(item => item.text === formFields['method'])}
                                                    itemToString={(entry) => (entry) ? entry.text : ""}
                                                    onChange={e => this.dropdownFieldValueChanged('method', e)}
                                                />
                                            }
                                        </td>
                                    </tr>

                                    <tr>
                                        <td className='fieldLabel'><label>Path</label></td>
                                        <td>
                                            {this.state.loadingData ?
                                                <TextInputSkeleton hideLabel /> :
                                                <TextInput
                                                    className="inputField"
                                                    id='path'
                                                    disabled={saveInProgress}
                                                    autoComplete="off"
                                                    invalid={!isPathValid.valid}
                                                    invalidText={`${isPathValid.message}`}
                                                    labelText=''
                                                    hideLabel
                                                    aria-label="Path"
                                                    value={formFields['path']}
                                                    onChange={e => this.fieldValueChanged(e)}
                                                    placeholder='eg: /myapi' />
                                            }
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className='fieldLabel'><label>Requests/second</label></td>
                                        <td>
                                            {this.state.loadingData ?
                                                <TextInputSkeleton hideLabel /> :
                                                <TextInput
                                                    className="inputField"
                                                    id='requestsPerSecond'
                                                    disabled={saveInProgress}
                                                    autoComplete="off"
                                                    invalid={!isRequestsValid.valid}
                                                    invalidText={`${isRequestsValid.message}`}
                                                    labelText=''
                                                    hideLabel
                                                    aria-label="Requests per second"
                                                    value={formFields['requestsPerSecond']}
                                                    onChange={e => this.fieldValueChanged(e)}
                                                    placeholder='Requests per second eg: 30' />
                                            }
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className='fieldLabel'><label>Concurrent</label></td>
                                        <td>
                                            {this.state.loadingData ?
                                                <TextInputSkeleton hideLabel /> :
                                                <TextInput
                                                    className="inputField"
                                                    id='concurrency'
                                                    disabled={saveInProgress}
                                                    autoComplete="off"
                                                    invalid={!isConcurrentValid.valid}
                                                    invalidText={`${isConcurrentValid.message}`}
                                                    labelText=''
                                                    hideLabel
                                                    aria-label="Concurrency"
                                                    value={formFields['concurrency']}
                                                    onChange={e => this.fieldValueChanged(e)}
                                                    placeholder='Concurrent threads' />
                                            }
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className='fieldLabel'><label>Duration</label></td>
                                        <td>
                                            {this.state.loadingData ?
                                                <TextInputSkeleton hideLabel /> :
                                                <TextInput
                                                    className="inputField"
                                                    id='maxSeconds'
                                                    disabled={saveInProgress}
                                                    autoComplete="off"
                                                    invalid={!isDurationValid.valid}
                                                    invalidText={`${isDurationValid.message}`}
                                                    labelText=''
                                                    hideLabel
                                                    aria-label="Duration"
                                                    value={formFields['maxSeconds']}
                                                    onChange={e => this.fieldValueChanged(e)}
                                                    placeholder='Test run duration' />
                                            }
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className='fieldLabel'><label>JSON Body</label></td>
                                        <td>
                                            {this.state.loadingData ?
                                                <TextInputSkeleton hideLabel /> :
                                                <TextArea
                                                    className="inputField"
                                                    style={{ "resize": "none" }}
                                                    id='body'
                                                    light={true}
                                                    disabled={saveInProgress}
                                                    autoComplete="off"
                                                    invalid={!isBodyValid.valid}
                                                    invalidText={`${isBodyValid.message}`}
                                                    labelText=''
                                                    aria-label="JSON body"
                                                    hideLabel
                                                    value={formFields['body']}
                                                    onChange={e => this.fieldValueChanged(e)}
                                                    placeholder='{"id": 1, "message":"hello"}' />
                                            }
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </form>
                    }
                    <div className="errorMessage">{modalErrorText}</div>
                </div>
            </Modal>
        )
    }
}

const mapStateToProps = stores => {
    return {
        lang: stores.localeReducer.lang,
        projectMetricTypes: stores.projectMetricTypesReducer,
        loadRunnerConfig: stores.loadRunnerConfigReducer
    };
};

ModalModifyLoadTests.propTypes = {
    open: PropTypes.bool.isRequired,  // should modal dialog be displaye
    closeModalWindow: PropTypes.func.isRequired // callback to close modal
};

export default connect(mapStateToProps)(ModalModifyLoadTests);
