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

import React, { PureComponent } from 'react'
import ErrorBoundary from '../../utils/ErrorBoundary';
import PropTypes from 'prop-types';

export default class InlineHTML extends PureComponent {

  render() {
    return (
      <ErrorBoundary>
        <div className="InlineHTML" dangerouslySetInnerHTML={{ __html: this.props.markup }} />
      </ErrorBoundary>
    )
  }
}

InlineHTML.propTypes = {
  markup: PropTypes.string.isRequired,
}
