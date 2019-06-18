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
import { Icon, TextArea, Loading } from 'carbon-components-react';
import { iconEdit } from 'carbon-icons';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as AppConstants from '../../AppConstants';
import { formatDateToString } from '../../utils/dateTime';
import ProjectIDChecker from '../../utils/projectUtils';
import { reloadMetricsData } from '../../store/actions/projectMetricsActions';
import './DescriptionEditor.scss';

class DescriptionEditor extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            isBeingEdited: false,
            isBeingSaved: false,
            descFieldValue: '',
            snapshotDescription: ''
        }
        this.handleDescSave = this.handleDescSave.bind(this);
    }

    handleSwitchToEdit() {
        this.setState({ isBeingEdited: true, descFieldValue: this.props.descriptionText })
    }

    handleDescFieldChange(e) {
        let text = e.target.value;
        if (text.length <= AppConstants.MAX_DESC_LENGTH) {
            this.setState({ descFieldValue: text });
        }
    }

    componentDidMount() {
        this.setState({ snapshotDescription: this.props.descriptionText })
    }

    componentWillReceiveProps(nextProps) {
        if (this.state.snapshotDescription !== nextProps.descriptionText) {
            this.setState({ snapshotDescription: nextProps.descriptionText })
        }
    }

    /**
     * User wants to save the description, send the request and update the status.
     * Note,  the API wants the date format to be yyyymmddHHMMss.
     * 
     */
    async handleDescSave() {
        const projectid = ProjectIDChecker.projectID();
        const formattedTime = formatDateToString(this.props.snapshotTime);

        this.setState({ isBeingSaved: true, isBeingEdited: false });
        try {
            const result = await fetch(`${AppConstants.MICROCLIMATE_SERVER_API}/api/v1/projects/${projectid}/metrics/${formattedTime}`, {
                method: 'put',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ description: this.state.descFieldValue })
            });

            let data = await result.json();
            if (result.status === 200) {
                this.props.dispatch(reloadMetricsData(projectid, this.props.projectMetricTypes.types));
                this.setState({ isBeingSaved: false, snapshotDescription: data.description });
            } else {
                this.setState({ isSaving: false, errorText: result.statusText });
            }
        } catch (error) {
            alert(error);
            this.setState({ isSaving: false, errorText: error });
        }
    }

    handleDescCancel() {
        this.setState({ isBeingEdited: false, descFieldValue: this.props.descriptionText });
    }

    renderLayoutEditMode() {
        const { descFieldValue } = this.state;

        /* determine style class of the description field */
        let testCounterColor = '';
        if (descFieldValue.length > AppConstants.MAX_DESC_LENGTH - 10) { testCounterColor = 'warning'; }
        if (descFieldValue.length > AppConstants.MAX_DESC_LENGTH - 8) { testCounterColor = 'danger full'; }

        return (
            <Fragment>
                <TextArea labelText='' onChange={(e) => this.handleDescFieldChange(e)} value={descFieldValue}>EDIT</TextArea>
                <div className="footer">
                    <div className="charCounter">
                        <span className={testCounterColor}>{descFieldValue.length} / {AppConstants.MAX_DESC_LENGTH}</span>
                    </div>
                    <div className="actions">
                        <div className="link" onClick={(e) => this.handleDescCancel(e)} >Cancel</div>
                        <div className="link" onClick={(e) => this.handleDescSave(e)} >Save</div>
                    </div>
                </div>
            </Fragment>
        );
    }

    renderLayoutViewMode() {
        return (<div className='testDescription'>
            {this.state.snapshotDescription}

            {this.state.isBeingSaved ?
                <Loading style={{ 'height': '25px', 'width': '25px', 'marginTop': '-3px' }} className="inline" withOverlay={false} small />
                :
                <Icon className="iconEdit link" description="Edit comment" style={{ marginLeft: '5px', 'width': '16px', 'height': '16px' }} onClick={() => this.handleSwitchToEdit()} icon={iconEdit} iconTitle="Edit Comment" />

            }
        </div>)
    }

    render() {
        const { isBeingEdited } = this.state;
        return (
            <div className="DescriptionEditor">
                {
                    isBeingEdited ? this.renderLayoutEditMode() : this.renderLayoutViewMode()
                }
            </div>
        )
    }
}

DescriptionEditor.propTypes = {
    descriptionText: PropTypes.string.isRequired,
    snapshotTime: PropTypes.number.isRequired
};

// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectMetricTypes: stores.projectMetricTypesReducer,
        lang: stores.localeReducer.lang
    };
};

export default connect(mapStateToProps)(DescriptionEditor);
