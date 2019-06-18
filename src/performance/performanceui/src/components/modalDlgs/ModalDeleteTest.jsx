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
import { Modal } from 'carbon-components-react';
import { connect } from 'react-redux';

import { TranslatedText } from '../../translations';

/**
 * Delete a test - Display modal
 */
class ModalDeleteTest extends React.Component {
  // eslint-disable-next-line class-methods-use-this
  render() {
    return (
      <Modal
        className="ModalDeleteTests"
        open
        danger={true}
        shouldsubmitonenter="true"
        modalLabel={TranslatedText(this.props.lang, "page.tests.delete.label", "Delete tests")}
        modalHeading={this.props.selectedRowCount > 1 ? TranslatedText(this.props.lang, "delete.modalheading.multi", "Multiple tests selected") : TranslatedText(this.props.lang, "delete.modalheading.single", "Delete selected test")}
        primaryButtonText={TranslatedText(this.props.lang, "page.tests.delete.confirmDelete", "Yes, delete")}
        secondaryButtonText={TranslatedText(this.props.lang, "page.tests.delete.cancelDelete", "No, don't delete")}
        iconDescription="Cancel"
        onRequestClose={() => this.props.handleCloseDeleteModal()}
        onRequestSubmit={() => this.props.executeDeleteTests()}
        onSecondarySubmit={() => this.props.handleCloseDeleteModal()}
      >
        <p>
          {this.props.selectedRowCount > 1 ?
            <span>
              {TranslatedText(this.props.lang, "page.tests.delete.multidesc", "Hmm... are you sure you want to trash all these? You won't be able to surface this data again... as in forever.")}
            </span>
            :
            <span>
              {TranslatedText(this.props.lang, "page.tests.delete.singledesc", " Hmm... are you sure you want to delete this test? You won't be able to surface this data again... as in forever.")}
            </span>
          }
        </p>
      </Modal >
    )
  }
}

ModalDeleteTest.propTypes = {
  handleCloseDeleteModal: PropTypes.func.isRequired,
  executeDeleteTests: PropTypes.func.isRequired,
  selectedRowCount: PropTypes.number.isRequired,
};

const mapStateToProps = stores => {
  return {
    lang: stores.localeReducer.lang,
  };
};

export default connect(mapStateToProps)(ModalDeleteTest);