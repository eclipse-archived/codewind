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

import React, { } from 'react';
import './App.scss';
import HeaderBar from './components/headerBar/HeaderBar';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import { connect } from 'react-redux';
import { setLocale } from './store/actions/localeActions';
import PageCharts from './pages/PageCharts';
import PageManageTests from './pages/PageManageTests';
import * as ProjectIDChecker from './utils/projectUtils';
import ModalNoProjectID from './components/modalDlgs/ModalNoProjectID';
import { ROUTES_CHARTS, ROUTES_MANAGE } from './AppConstants';
import io from 'socket.io-client'
import SocketContext from './utils/sockets/SocketContext'

const socket = io('http://localhost:9090/default', { timeout:'5000'})

class App extends React.Component {

  componentWillMount() {
    let storedLang = localStorage.lang;
    // Set a default locale
    if (!storedLang) {
      storedLang = 'en';
      localStorage.lang = storedLang;
    }
    // Update redux store if required
    if (storedLang !== this.props.lang) {
      this.props.dispatch(setLocale(storedLang));
    }
  }

  // eslint-disable-next-line class-methods-use-this
  render() {
    const projectID = ProjectIDChecker.projectID();
    let publicURL = `${process.env.PUBLIC_URL}`;

    if (!publicURL) publicURL = '';

    return (
      <SocketContext.Provider value={socket}>
      <div className="App">
        <HeaderBar />
        <div className="pageContent">
          {(!projectID) ? <ModalNoProjectID /> :
            <Router >
              <div>
                <Route exact path={`${publicURL}`} component={PageCharts} />
                <Route path={`${publicURL}/${ROUTES_CHARTS}`} component={PageCharts} />
                <Route path={`${publicURL}/${ROUTES_MANAGE}`} component={PageManageTests} />
              </div>
            </Router>
          }
        </div>
      </div>
      </SocketContext.Provider>
    );
  }
}


const mapStateToProps = stores => {
  return {
    lang: stores.localeReducer.lang
  }
}

export default connect(mapStateToProps)(App);
