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
import { iconDelete } from 'carbon-icons';
import { connect } from 'react-redux';
import { formatDateToString } from '../../../utils/dateTime';
import ProjectIDChecker from '../../../utils/projectUtils';
import ModalDeleteTest from '../../modalDlgs/ModalDeleteTest'

import { postDeleteTest, reloadMetricsData } from '../../../store/actions/projectMetricsActions';

class DeleteTestAction extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            showModalDelete: false,
            isDeleteInProgress: false
        }
        this.handleDeleteTestClick = this.handleDeleteTestClick.bind(this);
        this.handleCloseDeleteModal = this.handleCloseDeleteModal.bind(this);
        this.handleRequestDelete = this.handleRequestDelete.bind(this);
    }

    handleDeleteTestClick() {
        this.setState({ showModalDelete: true });
    }

    handleCloseDeleteModal() {
        this.setState({ showModalDelete: false, isDeleteInProgress: false });
    }

    async handleRequestDelete() {
        if (this.state.isDeleteInProgress) {
            return;
        }
        this.setState({ isDeleteInProgress: true });
        const projectid = ProjectIDChecker.projectID();
        const formattedTime = formatDateToString(this.props.snapshot.time);
        let deleteCandidates = [formattedTime];
        const result = await postDeleteTest(projectid, deleteCandidates);
        if (result.status && result.status === 200) {
            this.props.dispatch(reloadMetricsData(projectid, this.props.projectMetricTypes.types));
        } else {
            alert(`Unable to delete test: ${result.message}`);
        }
        this.setState({ showModalDelete: false, isDeleteInProgress: false });
    }

    render() {
        const { showModalDelete, isDeleteInProgress } = this.state;
        return (
            <Fragment>
                <Icon description="Delete load test" className={this.state.isDeleteInProgress ? "iconDisabled" : 'icon'} style={{ marginLeft: '5px', 'width': '16px' }} onClick={() => this.handleDeleteTestClick()} icon={iconDelete} iconTitle="Delete load test data" />
                {showModalDelete ? <ModalDeleteTest
                    deleteInProgress={isDeleteInProgress}
                    handleCloseDeleteModal={this.handleCloseDeleteModal}
                    executeDeleteTests={this.handleRequestDelete}
                    selectedRowCount={1}
                /> : <Fragment />}
            </Fragment>
        )
    }
}

DeleteTestAction.propTypes = {
    snapshot: PropTypes.object.isRequired
};

// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectMetricTypes: stores.projectMetricTypesReducer
    };
};

export default connect(mapStateToProps)(DeleteTestAction);