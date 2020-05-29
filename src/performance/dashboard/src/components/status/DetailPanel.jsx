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

import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types';
import InlineHTML from './messages/InlineHTML';
import ErrorBoundary from '../utils/ErrorBoundary';
import MPDisableAuth from './messages/MPDisableAuth';
import MPEnableAuth from './messages/MPEnableAuth';
import * as Constants from './Constants';

import './DetailsPanel.scss'

class DetailPanel extends Component {

  render() {

    let detailSubComponent;

    switch (this.props.detailSubComponent) {
      case Constants.MESSAGE_COMPONENT_SIMPLE:
        detailSubComponent = <InlineHTML markup={this.props.messageText} />
        break;
      case Constants.MESSAGE_COMPONENT_LIVEMETRICS_MICROPROFILE_DISABLE_AUTH:
        detailSubComponent = <MPDisableAuth projectID={this.props.projectID} />
        break;
      case Constants.MESSAGE_COMPONENT_LIVEMETRICS_MICROPROFILE_ENABLE_AUTH:
        detailSubComponent = <MPEnableAuth  projectID={this.props.projectID} />
        break;
      default:
        detailSubComponent = <Fragment></Fragment>
    }
    return (
      <div className={this.props.show ? "DetailsPanel reveal" : "DetailsPanel"}>
        <div className="detailPanelBox">
          <div className="detailBody">
            <ErrorBoundary>
              {detailSubComponent}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    )
  }
}

DetailPanel.propTypes = {
  show: PropTypes.bool.isRequired,
  messageText: PropTypes.string.isRequired,
  detailSubComponent: PropTypes.string.isRequired,
}

export default DetailPanel;
