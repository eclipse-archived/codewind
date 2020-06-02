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
import io from 'socket.io-client'

import { BrowserRouter as Router, Route } from 'react-router-dom';

import './index.scss';

import ErrorBoundary from './components/utils/ErrorBoundary';
import ModalNoProjectID from './components/modals/ModalNoProjectID';
import NavBar from './components/navBar/NavBar';
import PagePerformance from './pages/PagePerformance';
import SocketContext from './utils/sockets/SocketContext';
import Notifications from './components/notifications/Notifications';
import SocketWatcherProjectStatus from './components/socketWatchers/ProjectStatus';
import SocketWatcherProjectClosed from './components/socketWatchers/ProjectClosed';
import * as ProjectIDChecker from './utils/projectUtils';
import * as AppConstants from './AppConstants';

let socketURL = `${AppConstants.API_HOST}/default`;
let socketPath = `${AppConstants.API_ROOT}/socket.io/`;

const socket = io(socketURL, {
  timeout: '5000',
  path: socketPath,
});

// Authenticate socket after connecting
socket.on('connect', function(){
  const accessToken = localStorage.getItem("cw-access-token");
  if (accessToken) {
    socket.emit('authentication', {  token:  accessToken});
  }
});

socket.on('connect_error', function(error) {
  console.error("Dashboard Socket connect_error: ", error);
});

socket.on('connect_timeout', function(timeout) {
  console.warn("Dashboard Socket connect_timeout: ", timeout);
});

socket.on('error', function(error) {
  console.error("Dashboard Socket error: ", error);
});

socket.on('disconnect', function(reason) {
  console.warn("Dashboard Socket disconnect: ", reason);
});

socket.on('reconnect', function(attemptNumber) {
  console.warn("Dashboard Socket reconnect.  Attempt # ", attemptNumber);
});

socket.on('reconnecting', function(attemptNumber) {
  console.warn("Dashboard Socket reconnecting. Attempt #", attemptNumber);
});

socket.on('reconnect_error', function(error) {
  console.error("Dashboard Socket reconnect_error : ", error);
});

socket.on('reconnect_failed', function() {
  console.error("Dashboard Socket reconnect_failed");
});

function App() {

  const projectID = ProjectIDChecker.projectID();

  return (
    <SocketContext.Provider value={socket}>
      <div className="App">
        <ErrorBoundary>
            <Notifications/>
        </ErrorBoundary>
        <ErrorBoundary>
            <SocketWatcherProjectClosed projectID={projectID}/>
            <SocketWatcherProjectStatus projectID={projectID}/>
        </ErrorBoundary>
        <Fragment>
          <ErrorBoundary>
            <NavBar projectID={projectID} />
          </ErrorBoundary>
          {(!projectID) ? <ModalNoProjectID /> :
            <Router basename={`${AppConstants.API_ROOT}/performance`}>
              <Route exact={true} path='/' render={(props) => <PagePerformance {...props} projectID={projectID} />} />
              <Route exact={true} path='/charts' render={(props) => <PagePerformance {...props} projectID={projectID} />} />
            </Router >
          }
        </Fragment>
      </div>
    </SocketContext.Provider>
  );
}

export default App;
