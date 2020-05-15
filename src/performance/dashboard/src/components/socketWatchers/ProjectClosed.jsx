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

import React, { Component, Fragment } from 'react'
import { connect } from 'react-redux';
import PropTypes from 'prop-types'
import queryString from 'query-string';

import { SocketEvents } from '../../utils/sockets/SocketEvents';
import SocketContext from '../../utils/sockets/SocketContext';
import { addNotification, KIND_WARNING, NOTIFICATION_TIMEOUT_MEDIUM } from '../../store/actions/notificationsActions';

class ProjectClosed extends Component {

  componentDidMount() {
    if (!this.props.projectID) { return; }
    this.bindSocketHandlers();
  }

  bindSocketHandlers() {
    const uiSocket = this.props.socket;
    let thisComponent = this;

    uiSocket.on(SocketEvents.PROJECT_CLOSED, data => {
      if (queryString.parse(location.search).debugsocket) {
        console.log(`SocketIO RX: ${SocketEvents.PROJECT_CLOSED}`, data);
      }
      if (data.projectID === this.props.projectID) {
        thisComponent.props.dispatch(addNotification(
          {
            kind: KIND_INFO,
            title: 'Project status: closed',
            caption: "The project has stopped.",
            timeout: NOTIFICATION_TIMEOUT_MEDIUM,
          }
        ));
      }
    });
  }

  render() {
    return (
      <Fragment />
    )
  }
}

// Add UI SocketContext via props
const ProjectClosedWithSocket = props => (
  <SocketContext.Consumer>
    {socket => <ProjectClosed {...props} socket={socket} />}
  </SocketContext.Consumer>
)

// Mapped Redux Stores
const mapStateToProps = stores => {
  return {
    notifications: stores.notificationsReducer,
  }
};

ProjectClosed.propTypes = {
  projectID: PropTypes.string.isRequired
}

export default connect(mapStateToProps)(ProjectClosedWithSocket);
