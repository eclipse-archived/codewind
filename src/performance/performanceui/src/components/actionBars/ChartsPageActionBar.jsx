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
import { Button } from 'carbon-components-react';
import { Link } from 'react-router-dom';
import { TranslatedText } from '../../translations';
import { connect } from 'react-redux';
import ListBulleted from '@carbon/icons-react/lib/list--bulleted/16';
import PropTypes from 'prop-types';
import ActionModifyTestRunParameters from '../actions/ActionModifyTestRunParameters';
import ActionRunLoad from '../actions/ActionRunLoad';
import * as AppConstants from '../../AppConstants';

class ChartsPageActionBar extends React.Component {

    // eslint-disable-next-line class-methods-use-this
    render() {
        return (
            <div className='RegressionActionBar'>
                <ActionModifyTestRunParameters /> 
                <Link style={{ textDecoration: 'none' }} to={`${AppConstants.ROUTES_MANAGE}?project=${this.props.projectID}`}>
                    <Button className="actionButton" renderIcon={ListBulleted} >{TranslatedText(this.props.lang, "page.tests.managebtn", 'Manage Tests')}</Button>
                </Link>
                <ActionRunLoad projectID={this.props.projectID} />
            </div>
        )
    }
}

const mapStateToProps = stores => {
    return {
        lang: stores.localeReducer.lang,
    };
};


ChartsPageActionBar.propTypes = {
    projectID: PropTypes.string.isRequired
};

export default connect(mapStateToProps)(ChartsPageActionBar);
