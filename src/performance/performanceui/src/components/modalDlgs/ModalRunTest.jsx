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
import { TranslatedText } from '../../translations';
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



  showRunTestModal() {
    this.setState({ runTestDescription: '', showModalRunTest: true })
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
          open
          danger={false}
          shouldsubmitonenter="false"
          modalLabel=""
          modalHeading={TranslatedText(this.props.lang, "page.tests.addDesc", "Add Test Description")}
          primaryButtonText={TranslatedText(this.props.lang, "btn.save", "Save")}
          secondaryButtonText={TranslatedText(this.props.lang, "btn.cancel", "Cancel")}
          iconDescription={TranslatedText(this.props.lang, "btn.cancel", "Cancel")}
          onRequestClose={this.props.handleRunTestDlgClose}
          onRequestSubmit={() => this.props.handleRunTestDlgStart(this.state.runTestDescription)}
          onSecondarySubmit={this.props.handleRunTestDlgClose}
        >
          <TextArea
            style={{ resize: "none" }}
            className="descriptionTextArea"
            hideLabel={false}
            labelText=""
            value={this.state.runTestDescription}
            invalidText=""
            helperText=""
            placeholder={TranslatedText(this.props.lang, "page.tests.describe", "Describe this new test")}
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