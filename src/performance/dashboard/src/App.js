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
import * as ProjectIDChecker from './utils/projectUtils';
import * as AppConstants from './AppConstants';

let socketURL = `${AppConstants.API_SERVER}/default`;

const socket = io(socketURL, { timeout: '5000' });

function App() {

  const projectID = ProjectIDChecker.projectID();
 
  return (
    <SocketContext.Provider value={socket}>
      <div className="App">
        <Fragment>
          {/*  <GridDebug />  */}
          <ErrorBoundary>
            <NavBar projectID={projectID} />
          </ErrorBoundary>
          {(!projectID) ? <ModalNoProjectID /> :
            <Router basename={'/performance'}>
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
