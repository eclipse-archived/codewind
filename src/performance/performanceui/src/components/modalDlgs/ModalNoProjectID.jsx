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

import { Modal } from 'carbon-components-react';
import React, { } from 'react';

import './ModalNoProjectID.scss'

/**
 * ModalNoProjectID - Display modal
 */
class ModalNoProjectID extends React.Component {
  // eslint-disable-next-line class-methods-use-this
  render() {
    return (
      <div>
        <Modal id="RegressionTestNoID"
          open={true}
          danger={true}
          passiveModal={true}
          shouldsubmitonenter="false"
          modalLabel="Unable connect to your project"
          modalHeading="Missing Project ID"
          primaryButtonText="Save"
          secondaryButtonText="Cancel"
          iconDescription="Cancel">
          <p>Expected a URL QueryString option with a valid projectID similar to:</p>
          <p>?project=1234-3455-1234....</p>
          <br />
          <p>Check the page URL and try opening again.</p>
          <button style={{ opacity: '0' }}></button>
        </Modal>
      </div>
    )
  }
}
export default ModalNoProjectID;
