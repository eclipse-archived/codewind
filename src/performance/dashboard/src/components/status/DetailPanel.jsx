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
import PropTypes from 'prop-types';

import './DetailsPanel.scss'

class DetailPanel extends Component {

  constructor() {
    super();
    this.state = {
      display: false
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.show != this.state.display) {
      this.state.display = nextProps.show
    }
  }

  render() {
    return (
      <div className={this.state.display ? "DetailsPanel reveal" : "DetailsPanel"}>
        <div className="detailPanelBox">
          <div className="detailTitle">Additional information</div>
          <div className="detailBody" dangerouslySetInnerHTML={{__html: this.props.messageText }}></div>
        </div>
      </div>
    )
  }

}

DetailPanel.propTypes = {
  show: PropTypes.bool.isRequired,
  messageText: PropTypes.string.isRequired,
}

export default DetailPanel;
