/*******************************************************************************
* Copyright (c) 2020 IBM Corporation and others.
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

import { SocketEvents } from '../../utils/sockets/SocketEvents';
import SocketContext from '../../utils/sockets/SocketContext';

import './StatusPanel.scss';

class StatusPanel extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            showOutOfDateMetrics: false
        }
    }

    componentDidMount() {
        this.props.socket.on(SocketEvents.RUNLOAD_STATUS_CHANGED, data => {
            if (data.projectID === this.props.projectID) {
                switch (data.status) {
                    case 'app-is-using-old-metrics': {
                        this.setState({ showOutOfDateMetrics: true });
                        break;
                    }
                }
            }
        });
    }

    render() {
        const { showOutOfDateMetrics } = this.state;
        return (
            <Fragment>
                {showOutOfDateMetrics ? <div className="StatusPanelWarning">An old version of Appmetrics has been detected. Results may be inaccurate until you update Appmetrics within your project.</div> : <Fragment />}
            </Fragment>
        )
    }
}

// Add UI SocketContext via props
const StatusPanelWithSocket = props => (
    <SocketContext.Consumer>
        {socket => <StatusPanel {...props} socket={socket} />}
    </SocketContext.Consumer>
)

StatusPanel.propTypes = {
    projectID: PropTypes.string.isRequired
}

export default StatusPanelWithSocket;
