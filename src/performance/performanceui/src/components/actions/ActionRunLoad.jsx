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

import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import Play from '@carbon/icons-react/lib/play/16';
import Stop from '@carbon/icons-react/lib/close--outline/16';
import { Button, InlineLoading } from 'carbon-components-react';
import { SocketEvents } from '../../utils/sockets/SocketEvents';
import { TranslatedText } from '../../translations';
import SocketContext from '../../utils/sockets/SocketContext';
import RunTestNotificationFail from '../notifications/RunTestNotificationFail';
import ModalRunTest from '../modalDlgs/ModalRunTest';
import * as AppConstants from '../../AppConstants';

import './ActionRunLoad.scss';

class ActionRunLoad extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            loadRunStatus: { projectID: '', status: '' },
            showModalRunTest: false,
            runTestDescription: '',
            inlineTextLabel:'Running...',
            showNotificationRunTestFail: false,
            notificationError: { result: 0, message: "" }
        }
        this.showRunTestModal = this.showRunTestModal.bind(this);
        this.handleRunTestDlgClose = this.handleRunTestDlgClose.bind(this);
        this.requestRunLoad = this.requestRunLoad.bind(this);
        this.handleCancelLoad = this.handleCancelLoad.bind(this);
        this.handleRunTestDlgStart = this.handleRunTestDlgStart.bind(this);
        this.showStartTestNotificationFail = this.showStartTestNotificationFail.bind(this);
    }

    componentDidMount() {
        this.props.socket.on(SocketEvents.RUNLOAD_STATUS_CHANGED, data => {
            if (data.projectID === this.props.projectID) {
                this.setState({ loadRunStatus: data });
            }

            // after receiving a loadrun completion event,  wait a bit then reset the button back to ready
            if (data.status === 'completed' && data.projectID === this.props.projectID) {
                let nextData = data;
                nextData.status = 'idle';
                setTimeout(() => this.setState({ loadRunStatus: nextData }), 2000);
            }
        });
    }

    /**
     * Ask API to start a new test
     */
    handleRunTestDlgStart(descriptionText) {
        let t = this;
        this.requestRunLoad(descriptionText).then(function (result) {
            t.setState({ showModalRunTest: false, inlineTextLabel:'Running...' });
            switch (result.status) {
                case 202: {
                    // success - request to start load accepted;
                    break;
                }
                case 503: {
                    t.showStartTestNotificationFail({ result: result.status, message: "Reason: Your project is not running" });
                    break;
                }
                case 409: {
                    t.showStartTestNotificationFail({ result: result.status, message: "Reason: A load run is already in progress" });
                    break;
                }
                default: {
                    t.showStartTestNotificationFail({ result: result.status, message: `${result.status} - Unable to accept request` });
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
        const response = await fetch(`${AppConstants.MICROCLIMATE_SERVER_API}/api/v1/projects/${this.props.projectID}/loadtest`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: descriptionPayload
            });
        const reply = await response;
        return reply;
    }

    async handleCancelLoad() {
        this.setState({inlineTextLabel: "Cancelling..."});
        try {
            const response = await fetch(`${AppConstants.MICROCLIMATE_SERVER_API}/api/v1/projects/${this.props.projectID}/cancelLoad`, 
            {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const reply = await response;
            console.log(reply);
            this.setState({inlineTextLabel: "Cancelled"});
        } catch (err) {
            this.setState({inlineTextLabel: "Cancel failed"});
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
            { showNotificationRunTestFail: true, notificationError: err },
            () => setTimeout(() => this.setState({ showNotificationRunTestFail: false }), 5000)
        );
    }

    render() {
        const { showNotificationRunTestFail, loadRunStatus, inlineTextLabel } = this.state;
        let loadRunActive = loadRunStatus.status === 'started';
        let loadRunSuccess = loadRunStatus.status === 'completed';

        return (
            <Fragment>
                <RunTestNotificationFail notification={showNotificationRunTestFail} titleMessage={'Request Failed!'} notificationError={this.state.notificationError} />
                <div className="ActionRunLoad">
                    {
                        (loadRunActive || loadRunSuccess) ? (
                            <Fragment>
                            <div style={{ display: 'inline-block', verticalAlign: "middle" }}>
                                <InlineLoading style={{ marginLeft: '1rem' }} description={inlineTextLabel} success={loadRunSuccess} />
                            </div>
                            <div style={{ display: 'inline-block', verticalAlign: "middle", float:'right' }}>
                                <Button onClick={() => this.handleCancelLoad()} style={{verticalAlign: "middle", padding:0, margin:0}}renderIcon={Stop} kind="ghost" small iconDescription="Stop the load run"></Button>
                            </div>
                            </Fragment>
                        ) : (
                            <Fragment>
                                <Button className="actionButton" renderIcon={Play} onClick={() => this.showRunTestModal()}>{TranslatedText(this.props.lang, "page.tests.starttest", 'Run Load Test')}</Button>
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
    projectID: PropTypes.string.isRequired
}

export default (ActionRunLoadWithSocket);
