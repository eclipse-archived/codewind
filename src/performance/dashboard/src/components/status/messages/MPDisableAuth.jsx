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
import ActionDisableMicroProfileAuth from './actions/ActionDisableMicroProfileAuth'
import PropTypes from 'prop-types';

import './styles.scss'

export default class MPDisableAuth extends Component {

  render() {
    return (
      <div className="MPDisableAuth">
        If you wish to see live metrics, you can disable authentication by modifying the server.xml file in your project.
        <br />
        You can locate this file at src/main/liberty/config/server.xml. Modify server.xml and add or update: <br /><br />&lt;mpMetrics authentication=&quot;false&quot;/&gt;
        <br /><br />
        for example:
        <br /><br />
        <div className="CodeBlock">
          &lt;featureManager&gt;
          <br />&nbsp;&nbsp;&lt;feature&gt;microProfile-2.0&lt;/feature&gt;
          <br />&lt;/featureManager&gt;
          <br />&lt;mpMetrics authentication=&quot;false&quot;/&gt;
        </div>
        <br />
         <ActionDisableMicroProfileAuth projectID={this.props.projectID} />
      </div>
    )
  }
}

MPDisableAuth.propTypes = {
  projectID: PropTypes.string.isRequired,
}
