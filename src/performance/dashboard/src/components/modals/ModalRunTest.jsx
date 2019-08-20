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
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Modal, TextArea } from 'carbon-components-react';
import { MAX_DESC_LENGTH } from '../../AppConstants';
import './ModalRunTest.scss';

const mapStateToProps = stores => {
  return {
    lang: stores.localeReducer.lang,
  };
};

/**
 * Run a test - Display modal
 */
class ModalRunTest extends React.Component {

  constructor() {
    super();
    this.state = {
      runTestDescription: ''
    }
    this.checkInputLength = this.checkInputLength.bind(this);
  }

  checkInputLength(e) {
    let value = e.target.value;
    if (value.length <= MAX_DESC_LENGTH) {
      this.setState({ runTestDescription: value });
    }
  }

  render() {

    const { runTestDescription } = this.state;
    let charCounterClass = '';

    if (runTestDescription.length > MAX_DESC_LENGTH - 10) {
      charCounterClass = 'warning';
    }
    if (runTestDescription.length > MAX_DESC_LENGTH - 8) {
      charCounterClass = 'danger full';
    }

    return (
      <div>
        <Modal
          id="ModalRunTest"
          open
          danger={false}
          shouldsubmitonenter="false"
          modalLabel=""
          modalAriaLabel="Run load test with an optional description"
          modalHeading="Run a new load test"
          primaryButtonText="Run"
          secondaryButtonText="Cancel"
          iconDescription="Cancel"
          onRequestClose={this.props.handleRunTestDlgClose}
          onRequestSubmit={() => this.props.handleRunTestDlgStart(this.state.runTestDescription)}
          onSecondarySubmit={this.props.handleRunTestDlgClose}
        >
          <TextArea
            style={{ resize: "none" }}
            className="descriptionTextArea"
            hideLabel={false}
            aria-label="Optional description"
            labelText="Add an optional description"
            value={this.state.runTestDescription}
            invalidText=""
            helperText=""
            placeholder="Describe this new test"
            onInput={(e, v) => this.checkInputLength(e, v)}
            onClick={() => { }}
          />
          <div className={`charCounter ${charCounterClass}`}>{runTestDescription.length} / {MAX_DESC_LENGTH}</div>
        </Modal>
      </div>
    )
  }
}

ModalRunTest.propTypes = {
  handleRunTestDlgClose: PropTypes.func.isRequired,
  handleRunTestDlgStart: PropTypes.func.isRequired
};

export default connect(mapStateToProps)(ModalRunTest);