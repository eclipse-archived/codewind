/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/

import React, { Fragment } from 'react'
import PropTypes from 'prop-types'

import './ResultsCard_Blank.scss'

class ResultsCard_Blank extends React.Component {

    render() {
        return (
            <div className="ResultsCardBlank">
                <div className='metrics-container'>
                    <div className='metrics-title'>
                        <div className='label'>{this.props.title}</div>
                    </div>
                </div>
            </div>
        )
    }
}

ResultsCard_Blank.propTypes = {
    title: PropTypes.string.isRequired
}

export default ResultsCard_Blank;
