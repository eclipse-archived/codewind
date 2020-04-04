/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/

import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import queryString from 'query-string';
import IconRun from '@carbon/icons-react/es/play--filled/16';
import IconStop from '@carbon/icons-react/lib/close--outline/16';
import { Button, InlineLoading } from 'carbon-components-react';
import { SocketEvents } from '../../utils/sockets/SocketEvents';
import SocketContext from '../../utils/sockets/SocketContext';
import { reloadMetricsData } from '../../store/actions/projectMetricsActions';
import RunTestNotificationFail from '../notifications/RunTestNotificationFail';
import ModalRunTest from '../modals/ModalRunTest';
import * as AppConstants from '../../AppConstants';

import './ActionRunLoad.scss';

class ActionRunLoad extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            loadRunStatus: { projectID: '', status: '' },
            showModalRunTest: false,
            runTestDescription: '',
            inlineTextLabel: 'Running...',
            showNotificationRunTestFail: false,
            notificationError: { result: 0, message: "" },
            timeRemaining: 0
        }
        this.countdownTimer = {}
        this.showRunTestModal = this.showRunTestModal.bind(this);
        this.handleRunTestDlgClose = this.handleRunTestDlgClose.bind(this);
        this.requestRunLoad = this.requestRunLoad.bind(this);
        this.handleCancelLoad = this.handleCancelLoad.bind(this);
        this.handleRunTestDlgStart = this.handleRunTestDlgStart.bind(this);
        this.showStartTestNotificationFail = this.showStartTestNotificationFail.bind(this);
        this.startCountdown = this.startCountdown.bind(this);
        this.updateTimeRemaining = this.updateTimeRemaining.bind(this);
    }

    componentDidMount() {
        this.props.socket.on(SocketEvents.RUNLOAD_STATUS_CHANGED, data => {
            if (data.projectID === this.props.projectID) {

                if (queryString.parse(location.search).debugsocket) {
                    console.log("SocketIO RX: ", data);
                }

                switch (data.status) {
                    case 'preparing': {
                        this.setState({ showModalRunTest: false, loadRunStatus: data, inlineTextLabel: 'Preparing...' });
                        break;
                    }
                    case 'connecting': {
                        this.setState({ showModalRunTest: false, loadRunStatus: data, inlineTextLabel: 'Connecting....' });
                        break;
                    }
                    case 'starting': {
                        this.setState({ showModalRunTest: false, loadRunStatus: data, inlineTextLabel: 'Starting...' });
                        break;
                    }
                    case 'started': {
                        this.setState({ showModalRunTest: false, loadRunStatus: data, inlineTextLabel: 'Running...' });
                        this.startCountdown();
                        break;
                    }
                    case 'running': {
                        this.setState({ showModalRunTest: false, loadRunStatus: data, inlineTextLabel: 'Running...' });
                        break;
                    }
                    case 'completed': {
                        // after receiving a loadrun completion message,  wait a bit,  then reset the button back to ready
                        this.setState({ showModalRunTest: false, loadRunStatus: data, inlineTextLabel: 'Completed...' });
                        let nextData = data;
                        nextData.status = 'idle';
                        setTimeout(() => this.setState({ loadRunStatus: nextData }), 3000);
                        break;
                    }
                    case 'cancelling': {
                        this.setState({ showModalRunTest: false, loadRunStatus: data, inlineTextLabel: 'Cancelling...' });
                        break;
                    }
                    case 'cancelled': {
                        this.setState({ showModalRunTest: false, loadRunStatus: data, inlineTextLabel: 'Cancelled...' });
                        let nextData = data;
                        nextData.status = 'idle';
                        setTimeout(() => this.setState({ loadRunStatus: nextData }), 2000); 
                        break;
                    }
                    default: {
                        if (queryString.parse(location.search).debugsocket) {
                            console.log("Ignoring UISocket RX: ",data);
                        }
                    }
                }
            }
        });
    }

    /**
    * Ask API to start a new test
    */
    handleRunTestDlgStart(descriptionText) {
        this.setState({ showModalRunTest: false, loadRunStatus: { status: 'requesting' },  inlineTextLabel: 'Requesting...' });
        let instance = this;
        this.requestRunLoad(descriptionText).then(function (result) {
            switch (result.status) {
                case 202: {
                    // success - request to start load accepted;
                    instance.setState({ loadRunStatus: { status: 'requested' }, inlineTextLabel: 'Requested...' });
                    break;
                }
                case 503: {
                    instance.showStartTestNotificationFail({ result: result.status, message: "Reason: Your project is not running" });
                    break;
                }
                case 409: {
                    instance.showStartTestNotificationFail({ result: result.status, message: "Reason: A load run is already in progress" });
                    break;
                }
                default: {
                    instance.showStartTestNotificationFail({ result: result.status, message: `${result.status} - Unable to accept request` });
                }
            }
        }).catch(function (err) {
            alert(err);
        });
    }

    /**
     * Send a post to the metric/runload api to start a new load test. 
     * An optional description parameter can be provided.
     * @param {string} desc
     */
    // eslint-disable-next-line class-methods-use-this
    async requestRunLoad(desc) {
        let descriptionPayload = JSON.stringify({ description: desc });
        const response = await fetch(`${AppConstants.API_SERVER}/api/v1/projects/${this.props.projectID}/loadtest`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: descriptionPayload
            });
        const reply = await response;
        return reply;
    }

    async handleCancelLoad() {
        try {
            const response = await fetch(`${AppConstants.API_SERVER}/api/v1/projects/${this.props.projectID}/loadtest/cancel`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });
            const reply = await response;
            console.error("Cancel accepted")
        } catch (err) {
            console.error("Cancel failed:",err);
        }
    }

    handleRunTestDlgClose() {
        this.setState({ showModalRunTest: false });
    }

    showRunTestModal() {
        this.setState({ runTestDescription: '', showModalRunTest: true })
    }

    showStartTestNotificationFail(err) {
        this.setState(
            { showNotificationRunTestFail: true, notificationError: err,  loadRunStatus: { status: '' } },
            () => setTimeout(() => this.setState({ showNotificationRunTestFail: false }), 5000)
        );
    }

    updateTimeRemaining() {
        const timeRemaining = this.state.timeRemaining - 1;
        if (timeRemaining < 0) {
            clearInterval(this.countdownTimer);
        } else {
            this.setState({ timeRemaining: timeRemaining });
        }
    }

    startCountdown() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
        }
        const duration = parseInt(this.props.loadRunnerConfig.config.maxSeconds);
        this.setState({ timeRemaining: duration });
        this.countdownTimer = setInterval(this.updateTimeRemaining, 1000);
    }

    render() {
        const { showNotificationRunTestFail, loadRunStatus, inlineTextLabel, timeRemaining } = this.state;

        let loadRunCompleted = loadRunStatus.status === 'completed';
        const options = ['preparing', 'connecting', 'starting', 'started', 'running', 'completed', 'requesting', 'requested', 'cancelling', 'cancelled']
        const showBusy = options.includes(loadRunStatus.status)

        let inlineTextLabelFormatted = (timeRemaining !== 0) ? `${inlineTextLabel}${timeRemaining}` : `${inlineTextLabel}`

        return (
            <Fragment>
                <RunTestNotificationFail notification={showNotificationRunTestFail} titleMessage={'Request Failed!'} notificationError={this.state.notificationError} />
                <div className="ActionRunLoad">
                    {
                        (showBusy) ? (
                            <Fragment>
                                <div style={{ display: 'inline-block', verticalAlign: "middle" }}>
                                    <InlineLoading style={{ marginLeft: '1rem' }} description={inlineTextLabelFormatted} success={loadRunCompleted} />
                                </div>
                                <div style={{ display: 'inline-block', verticalAlign: "middle", float: 'right' }}>
                                    <Button onClick={() => this.handleCancelLoad()} style={{ verticalAlign: "middle", padding: 0, margin: 0 }} renderIcon={IconStop} kind="ghost" small iconDescription="Stop the load run"></Button>
                                </div>
                            </Fragment>
                        ) : (
                                <Fragment>
                                    <Button className="actionButton" small={this.props.small} kind={this.props.kind} renderIcon={IconRun} iconDescription="Run Load Test" onClick={() => this.showRunTestModal()}>Run Load Test</Button>
                                </Fragment>
                            )
                    }
                </div>

                {
                    this.state.showModalRunTest ?
                        <ModalRunTest
                            handleRunTestDlgClose={this.handleRunTestDlgClose}
                            handleRunTestDlgStart={this.handleRunTestDlgStart}
                        /> : <Fragment />
                }
            </Fragment>
        )
    }
}

// Add UI SocketContext via props
const ActionRunLoadWithSocket = props => (
    <SocketContext.Consumer>
        {socket => <ActionRunLoad {...props} socket={socket} />}
    </SocketContext.Consumer>
)

ActionRunLoad.propTypes = {
    projectID: PropTypes.string.isRequired,
    small: PropTypes.bool, // show small button
    kind: PropTypes.string // button kind eg: 'ghost'
}


// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectMetricTypes: stores.projectMetricTypesReducer,
        loadRunnerConfig: stores.loadRunnerConfigReducer
    };
};

export default connect(mapStateToProps)(ActionRunLoadWithSocket);
