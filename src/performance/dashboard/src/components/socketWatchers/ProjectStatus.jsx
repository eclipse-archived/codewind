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
import { addNotification, KIND_INFO, KIND_WARNING, KIND_SUCCESS, NOTIFICATION_TIMEOUT_MEDIUM } from '../../store/actions/notificationsActions';

class ProjectStatus extends Component {

  componentDidMount() {
    if (!this.props.projectID) { return; }
    this.bindSocketHandlers();
  }

  bindSocketHandlers() {
    const uiSocket = this.props.socket;
    let thisComponent = this;

    uiSocket.on(SocketEvents.PROJECT_STATUS_CHANGED, data => {
      if (queryString.parse(location.search).debugsocket) {
        console.log(`SocketIO RX: ${SocketEvents.PROJECT_STATUS_CHANGED}`, data);
      }
      if (data.projectID === this.props.projectID) {
        switch (data.appStatus) {
          case 'stopping': {
            thisComponent.props.dispatch(addNotification(
              {
                kind: KIND_INFO,
                title: 'Project status: stopping',
                caption: "The project is stopping, please wait...",
                timeout: NOTIFICATION_TIMEOUT_MEDIUM,
              }
            ));
            break;
          }

          case 'stopped': {
            thisComponent.props.dispatch(addNotification(
              {
                kind: KIND_INFO,
                title: 'Project status: stopped',
                caption: "The project is not running.",
                timeout: NOTIFICATION_TIMEOUT_MEDIUM,
              }
            ));
            break;
          }
          case 'starting': {
            thisComponent.props.dispatch(addNotification(
              {
                kind: KIND_INFO,
                title: 'Project status: starting',
                caption: 'The project is starting, please wait.',
                timeout: NOTIFICATION_TIMEOUT_MEDIUM,
              }
            ));
            break;
          }
          case 'started': {
            thisComponent.props.dispatch(addNotification(
              {
                kind: KIND_SUCCESS,
                title: 'Project status: running',
                caption: 'The project is running',
                timeout: NOTIFICATION_TIMEOUT_MEDIUM,
              }
            ));
            break;
          }
        }
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
const ProjectStatusWithSocket = props => (
  <SocketContext.Consumer>
    {socket => <ProjectStatus {...props} socket={socket} />}
  </SocketContext.Consumer>
)

// Mapped Redux Stores
const mapStateToProps = stores => {
  return {
    notifications: stores.notificationsReducer,
  }
};

ProjectStatus.propTypes = {
  projectID: PropTypes.string.isRequired
}

export default connect(mapStateToProps)(ProjectStatusWithSocket);
