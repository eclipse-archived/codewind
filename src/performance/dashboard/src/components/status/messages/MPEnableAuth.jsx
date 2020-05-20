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

import React, { Component } from 'react'
import ActionEnableMicroProfileAuth from './actions/ActionEnableMicroProfileAuth'
import PropTypes from 'prop-types';

import './styles.scss'

export default class MPEnableAuth extends Component {

  render() {
    return (
      <div className="MPEnableAuth">
        You can re-protect the metrics endpoint in your application forcing authentication by modifying the src/main/liberty/config/server.xml file in your project.
        <br />
        Note: <span className="note">Doing this will block Codewind from displaying metrics.</span>
        <br/>
        <br/>
        To continue, modify the server.xml and add or update: <br /><br />&lt;mpMetrics authentication=&quot;true&quot;/&gt;
        <br /><br />
        for example:
        <br /><br />
        <div className="CodeBlock">
          &lt;featureManager&gt;
          <br />&nbsp;&nbsp;&lt;feature&gt;microProfile-2.0&lt;/feature&gt;
          <br />&lt;/featureManager&gt;
          <br />&lt;mpMetrics authentication=&quot;true&quot;/&gt;
        </div>
        <br />
      <ActionEnableMicroProfileAuth projectID={this.props.projectID} />
      </div>
    )
  }
}

MPEnableAuth.propTypes = {
  projectID: PropTypes.string.isRequired,
}
