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

import React, { Fragment } from 'react'
import { Icon } from 'carbon-components-react';
import PropTypes from 'prop-types';
import { iconFavoriteSolid, iconFavoriteOutline } from 'carbon-icons';
import { connect } from 'react-redux';
import { updateFilteredLoadTests } from '../../../store/actions/chartFilteredTestsActions';

class AddFilteredLoadTestAction extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            isActive: false
        }
        this.handleToggleAction = this.handleToggleAction.bind(this);
    }

    handleToggleAction() {
        let newActiveState = !this.state.isActive;
        let filteredTests = this.props.filteredTests;
        if (!filteredTests) { filteredTests = []; }

        // if line is being added push it into the filteredTest list (if its not already there)
        if (newActiveState) {
            filteredTests.push({ snapshotTime: this.props.snapshot.time });
        } else { // remove the snapshot from the list
            let newList = filteredTests.filter(x => {
                return x.snapshotTime !== this.props.snapshot.time;
            })
            filteredTests = newList;
        }
        this.props.dispatch(updateFilteredLoadTests(filteredTests));
        this.setState({ isActive: newActiveState });

    }

    render() {
        const { isActive } = this.state;
        return (
            <Fragment>
                <Icon className="icon" description="Add to filter" style={{ marginLeft: '5px', 'width': '16px' }} onClick={() => this.handleToggleAction()} icon={(isActive) ? iconFavoriteSolid : iconFavoriteOutline} iconTitle="Add to Filter" />
            </Fragment>
        )
    }
}

AddFilteredLoadTestAction.propTypes = {
    snapshot: PropTypes.object.isRequired
};

// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectMetricTypes: stores.projectMetricTypesReducer,
        filteredTests: stores.chartFilteredTestsReducer.filterList
    };
};

export default connect(mapStateToProps)(AddFilteredLoadTestAction);