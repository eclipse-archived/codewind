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

import React, { } from 'react'
import PropTypes from 'prop-types'

export default class ErrorBoundaryChart extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }
  
    static getDerivedStateFromError(error) {
      return { hasError: true };
    }
    
    render() {
      if (this.state.hasError) {
        return <h1>{this.props.errMessage}</h1>;
      }
      return this.props.children; 
    }
  }

  ErrorBoundaryChart.propTypes = {
    errMessage: PropTypes.string.isRequired
  };
