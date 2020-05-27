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
        You can secure the metrics endpoint in your project by blocking anonymous access here:
        <br /> <br />
        <ActionEnableMicroProfileAuth projectID={this.props.projectID} />
      </div>
    )
  }
}

MPEnableAuth.propTypes = {
  projectID: PropTypes.string.isRequired,
}
