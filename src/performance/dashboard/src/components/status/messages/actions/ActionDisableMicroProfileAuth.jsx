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
import PropTypes from 'prop-types'
import {Button, InlineLoading} from 'carbon-components-react'

import IconEdit from '@carbon/icons-react/es/edit/16'

import * as AppConstants from '../../../../AppConstants';

class ActionDisableMicroProfileAuth extends Component {

  constructor() {
    super();
    this.state = {
        isSubmitting:false,
        success:false,
        description: "",
        ariaLive: "",
        errorMessage: "",
        disabled:false,
    }
    this.handleOnClick = this.handleOnClick.bind(this);
    this.dispatchRequest = this.dispatchRequest.bind(this);
}

   handleOnClick() {
    this.setState({isSubmitting: true, success:false, description:"Requesting", ariaLive:'assertive', errorMessage:'',  disabled:false});

    setTimeout(async () => {
      const response = await this.dispatchRequest();
      console.log("response;", response)
      if (response.status == 202) {
        setTimeout(() => {
          this.setState({success:true, description:"Accepted"});
          setTimeout(() => {
            this.setState({isSubmitting: false, success:false, description:"", ariaLive:'off', disabled:true});
          }, 1500);
        }, 2000);
      } else {
        this.setState({isSubmitting: false, success:false, description:"Failed", ariaLive:'assertive',  errorMessage:`HTTP  ${response.status} : ${response.statusText}`, disabled:true});
      }
    }, 1500);
  }

  /**
   * Send a post to the api to turn off authentication
   * @param {string} projectID
   */
  async dispatchRequest() {
    const response = fetch(`${AppConstants.API_SERVER}/api/v1/projects/${this.props.projectID}/metrics/disableauth`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: ""
        });
     const reply = await response;
     return reply;
  }

  render() {
    const {disabled, isSubmitting, success, description, ariaLive, errorMessage} = this.state
    if (disabled) { return  (
      <div className="ActionButton"><span className="errorMessage">{ errorMessage }</span> </div>
    )}


    return (
          <div className="ActionButton">
            {isSubmitting || success ? (
              <InlineLoading
                style={{ marginLeft: '1rem' }}
                description={description}
                success = {success}
                aria-live={ariaLive}
              />
            ) : (
              <Fragment>
              <Button
              kind="tertiary"
              disabled={disabled}
              renderIcon={IconEdit}
              aria-label="Disable Authentication"
              tabIndex={0}
              size="small"
              onClick={() => this.handleOnClick()}>Disable authentication</Button>
              </Fragment>
            )}
          </div>
    )
  }
}

ActionDisableMicroProfileAuth.propTypes = {
  projectID: PropTypes.string.isRequired
}

export default ActionDisableMicroProfileAuth;