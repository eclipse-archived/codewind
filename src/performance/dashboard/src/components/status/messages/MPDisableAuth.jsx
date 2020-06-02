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
        You can temporarily allow anonymous access to the project metrics collector here:
        <br /> <br />
         <ActionDisableMicroProfileAuth projectID={this.props.projectID} />
      </div>
    )
  }
}

MPDisableAuth.propTypes = {
  projectID: PropTypes.string.isRequired,
}
