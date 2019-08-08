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
import IconEdit from '@carbon/icons-react/es/edit/16'
import * as AppConstants from '../../AppConstants'
import { connect } from 'react-redux';
import { TextArea, Loading, Button } from 'carbon-components-react'
import { formatDateToString } from '../../utils/dateTime';
import { reloadMetricsData } from '../../store/actions/projectMetricsActions';

import './DescriptionEditor.scss';

class DescriptionEditor extends React.Component {

    constructor() {
        super()
        this.state = {
            isBeingSaved: false,
            editMode: false,
            text: '',
            descFieldValue: '',
            isMouseHover: false,
        }
        this.handleDescFieldChange = this.handleDescFieldChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.onMouseEnterHandler = this.onMouseEnterHandler.bind(this);
        this.onMouseLeaveHandler = this.onMouseLeaveHandler.bind(this);
    }

    componentDidMount() {
        this.setState({ text: this.props.text, descFieldValue: this.props.text })
    }

    componentWillReceiveProps(nextProps) {
        if (this.state.text !== nextProps.text) {
            this.setState({ text: nextProps.text })
        }
    }

    handleSwitchToEdit() {
        this.setState({ editMode: true, descFieldValue: this.props.text })
    }

    handleDescFieldChange(evt) {
        let text = evt.target.value;
        if (text.length <= AppConstants.MAX_DESC_LENGTH) {
            this.setState({ descFieldValue: text });
        }
    }

    onMouseEnterHandler() {
        this.setState({ isMouseHover: true })
    }
    onMouseLeaveHandler() {
        this.setState({ isMouseHover: false })
    }


    handleKeyDown(key) {
        switch (key.keyCode) {
            // escape
            case 27: {
                this.setState({ editMode: false });
                break;
            }
            // enter / return
            case 13: {
                key.preventDefault();
            }
            default: { }

        }
    }

    /**
      * User wants to save the description, send the request and update the status.
      * Note,  the API wants the date format to be yyyymmddHHMMss.
      * 
      */
    async handleDescSave() {
        const projectid = this.props.projectID;
        const formattedTime = formatDateToString(this.props.snapshotTime);
        this.setState({ isBeingSaved: true, editMode: false });
        try {
            const result = await fetch(`${AppConstants.API_SERVER}/api/v1/projects/${projectid}/metrics/${formattedTime}`, {
                method: 'put',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ description: this.state.descFieldValue })
            });

            await result.json();
            if (result.status === 200) {
                this.props.dispatch(reloadMetricsData(projectid, this.props.projectMetricTypes.types));
                this.setState({ isBeingSaved: false, text: this.state.descFieldValue });
            } else {
                this.setState({ isBeingSaved: false, errorText: result.statusText });
            }
        } catch (error) {
            alert(error);
            this.setState({ isBeingSaved: false, errorText: error });
        }
    }

    handleDescCancel() {
        this.setState({ editMode: false, descFieldValue: this.props.text });
    }

    render() {
        return (
            <div className="DescriptionEditor">
                {this.state.editMode ? this.renderLayoutEditMode() : this.renderLayoutReadMode()}
            </div>
        )
    }

    renderLayoutEditMode() {
        const { descFieldValue } = this.state;
        const editableValue = descFieldValue ? descFieldValue : '';

        /* determine style class of the description field */
        let testCounterColor = '';
        if (editableValue.length + 10 > AppConstants.MAX_DESC_LENGTH) { testCounterColor = 'warning'; }
        if (editableValue.length === AppConstants.MAX_DESC_LENGTH) { testCounterColor = 'danger'; }
        return (
            <Fragment>
                <TextArea onKeyDown={(e) => this.handleKeyDown(e)} placeholder='Description of test' labelText='' onChange={(e) => this.handleDescFieldChange(e)} value={editableValue}>EDIT</TextArea>
                <div className="footer">
                    <div className="charCounter">
                        <span className={testCounterColor}>{editableValue.length} / {AppConstants.MAX_DESC_LENGTH}</span>
                    </div>
                    <div className="actions">
                        <div className="link" onClick={(e) => this.handleDescCancel(e)} >Cancel</div>
                        <div className="link" onClick={(e) => this.handleDescSave(e)} >Save</div>
                    </div>
                </div>
            </Fragment>
        );
    }

    renderLayoutReadMode() {
        const { text } = this.state
        const color = text ? "" : "notext"
        const description = text ? text : "Description of test";
        return (
            <div className='description-text' onMouseEnter={this.onMouseEnterHandler} onMouseLeave={this.onMouseLeaveHandler}>
                <span onClick={() => this.handleSwitchToEdit()} className={color}>{(description)}</span>
                {this.state.isBeingSaved ?
                    <Loading style={{ 'height': '25px', 'width': '25px', 'paddingTop': '0px', 'marginLeft': '24px' }} className="inline" withOverlay={false} small />
                    :
                    <div className="iconEdit">
                        {
                            this.props.alwaysShowEditIcon || this.state.isMouseHover ?
                                <Button 
                                    className="editButton"
                                    small={true} 
                                    kind="ghost"
                                    tabindex="0" 
                                    renderIcon={IconEdit} 
                                    iconDescription="Edit test description" 
                                    onClick={() => this.handleSwitchToEdit()}>
                                </Button>
                                :
                                <div style={{ width: "25px" }}></div>
                        }
                    </div>
                }
            </div>
        )
    }
}

DescriptionEditor.propTypes = {
    projectID: PropTypes.string.isRequired, // projectID
    snapshotTime: PropTypes.number.isRequired, // start time of the snapshot
    text: PropTypes.string,
    alwaysShowEditIcon: PropTypes.bool.isRequired // should the edit icon be visible
}

// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectMetricTypes: stores.projectMetricTypesReducer
    };
};

export default connect(mapStateToProps)(DescriptionEditor);
