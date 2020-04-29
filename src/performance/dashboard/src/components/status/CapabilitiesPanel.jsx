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

import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'carbon-components-react';
import IconSuccess from '@carbon/icons-react/es/checkmark/20';
import IconFailure from '@carbon/icons-react/es/error/20';
import IconWarning from '@carbon/icons-react/es/warning--alt/20';
import { connect } from 'react-redux';
import * as Constants from './Constants';
import DetailPanel from './DetailPanel';
import { fetchProjectCapabilities } from '../../store/actions/projectCapabilitiesActions';
import './CapabilitiesPanel.scss';

class CapabilitiesPanel extends React.Component {

    constructor() {
        super();
        this.state = {
            lastUpdated: 0,
            detailMessage:"",
            revealDetail:false,
        };
        this.buildDisplayModel = this.buildDisplayModel.bind(this);
    }

    async componentDidMount() {
        if (!this.props.projectID) return;
        try {
            await this.props.dispatch(fetchProjectCapabilities(this.props.projectID))
        } catch (err) {
            console.log("Error loading capabilities: ", err)
        }
    }

    componentWillReceiveProps(newProps) {
        if (newProps.projectCapabilities.receivedAt !== this.state.lastUpdated) {
            this.setState({ lastUpdated: newProps.projectCapabilities.receivedAt })
        }
    }

    getIconMarkup(status) {
        switch (status) {
            case Constants.STATUS_OK:
                return <IconSuccess className='bx--btn__icon' style={{ 'fill': '#42be65' }} />
            case Constants.STATUS_ERROR:
                return <IconFailure className='bx--btn__icon' style={{ 'fill': '#da1e28' }} />
        }
        return <IconWarning className='bx--btn__icon' style={{ 'fill': '#f1c21b' }} />
    }

    handleContinueClick() {
        this.props.handleCapabilitiesClose();
    }

    getCapabilityProjectStatus(capabilityData, feature) {
        if (capabilityData.projectRunning) {
            feature.status = Constants.STATUS_OK;
            feature.statusMessage = Constants.MESSAGE_PROJECT_RUNNING;
        } else {
            feature.status = Constants.STATUS_ERROR;
            feature.statusMessage = Constants.MESSAGE_PROJECT_NOT_RUNNING;
        }
    }

    getCapabilityLoadRunnerStatus(capabilityData, feature) {
        if (capabilityData.projectRunning) {
            feature.status = Constants.STATUS_OK
            feature.statusMessage = Constants.MESSAGE_LOADRUNNER_AVAILABLE;
        } else {
            feature.status = Constants.STATUS_ERROR
            feature.statusMessage = Constants.MESSAGE_LOADRUNNER_NOT_AVAILABLE;
        }
    }

    getCapabilityLiveMetrics(capabilityData, feature) {
        if (!capabilityData.projectRunning) {
            feature.status = Constants.STATUS_ERROR
            feature.statusMessage = Constants.MESSAGE_PROJECT_NOT_RUNNING;
            return
        }

        if (capabilityData.liveMetricsAvailable) {
            feature.status = Constants.STATUS_OK
            feature.statusMessage = Constants.MESSAGE_LIVEMETRICS_AVAILABLE;
            return
        }

        if (capabilityData.microprofilePackageFoundInBuildFile) {
            feature.status = Constants.STATUS_WARNING
            feature.statusMessage = Constants.MESSAGE_LIVEMETRICS_MICROPROFILE;
            feature.detailMessage = Constants.MESSAGE_LIVEMETRICS_MICROPROFILE_DETAIL;
            return
        }

        if (capabilityData.canMetricsBeInjected) {
            feature.status = Constants.STATUS_WARNING;
            feature.statusMessage = Constants.MESSAGE_LIVEMETRICS_INJECT_REQUIRED;
            return
        }

        feature.status = Constants.STATUS_ERROR
        feature.statusMessage = Constants.MESSAGE_PROJECT_NOT_COMPATIBLE;
    }

    getCapabilityComparisons(capabilityData, feature) {
        if (!capabilityData.projectRunning) {
            feature.status = Constants.STATUS_WARNING
            feature.statusMessage = Constants.MESSAGE_COMPARISONS_NOT_RUNNING;
            return
        }

        if (capabilityData.appmetricsEndpointReachable && !capabilityData.hasTimedMetrics) {
            feature.status = Constants.STATUS_WARNING;
            feature.statusMessage = Constants.MESSAGE_COMPARISONS_INJECT_TIMED
            return
        }

        if (capabilityData.appmetricsEndpointReachable) {
            feature.status = Constants.STATUS_OK;
            feature.statusMessage = Constants.MESSAGE_COMPARISONS_AVAILABLE;
            return
        }

        if (capabilityData.canMetricsBeInjected) {
            feature.status = Constants.STATUS_ERROR;
            feature.statusMessage = Constants.MESSAGE_COMPARISONS_INJECT_REQUIRED;
            return
        }
        feature.status = Constants.STATUS_ERROR;
        feature.statusMessage = Constants.MESSAGE_PROJECT_NOT_COMPATIBLE;
    }


    buildDisplayModel() {
        const capabilityData = this.props.projectCapabilities.capabilities;
        const displayModelTemplate = [
            {
                id: "ProjectStatus", label: "Project Status", status: Constants.STATUS_WARNING,
                statusMessage: "Unable to determine status", detailMessage:""
            },
            {
                id: "LoadRunner", label: "Run Load Feature", status: Constants.STATUS_WARNING,
                statusMessage: "Unable to determine status", detailMessage:""
            },
            {
                id: "LiveMetrics", label: "Live Monitoring", status: Constants.STATUS_WARNING,
                statusMessage: "Unable to determine status", detailMessage:""
            },
            {
                id: "Comparisons", label: "Benchmarks", status: Constants.STATUS_WARNING,
                statusMessage: "Unable to determine status", detailMessage:""
            },
        ];

        // We always want to display all the features in the UI model so update status with results
        // from the capabilities API
        if (capabilityData) {
            let feature = displayModelTemplate.find(element => element.id == "ProjectStatus");
            this.getCapabilityProjectStatus(capabilityData, feature);

            feature = displayModelTemplate.find(element => element.id == "LoadRunner");
            this.getCapabilityLoadRunnerStatus(capabilityData, feature);

            feature = displayModelTemplate.find(element => element.id == "LiveMetrics");
            this.getCapabilityLiveMetrics(capabilityData, feature);

            feature = displayModelTemplate.find(element => element.id == "Comparisons");
            this.getCapabilityComparisons(capabilityData, feature);
        }
        return displayModelTemplate;
    }

    ShowDetailPanel(detailMessage) {
        if (detailMessage != this.state.detailMessage) {
            this.setState({revealDetail: true, detailMessage:detailMessage});
        } else {
            this.setState({revealDetail: false, detailMessage:""});
        }
    }

    render() {
        if (this.state.doNotShowAgain) return <Fragment />
        const dataModel = this.buildDisplayModel();
        return (
            <Fragment>
                <div className="Capabilities">
                    <div className="bannerPanel">
                        <div className="panelTitle" role="banner">
                            Project capabilities
                        </div>
                        <div className="panelSubTitle">
                            <span>Monitoring and performance measuring features currently available to you are:</span>
                            <Button iconDescription="Refresh Page" size="small" kind="ghost" onClick={() => window.location.reload(false)}>Refresh</Button>
                        </div>
                    </div>
                    <div className="rows" role="grid">
                        {
                            dataModel.map(row => {
                                return (
                                    <div key={row.id} className="row " role="gridcell">
                                        <div className="headline">
                                            <div className="icon">{this.getIconMarkup(row.status)}</div>
                                            <div className="capability">{row.label}</div>
                                        </div>
                                        <div className="description">{row.statusMessage}</div>
                                        {
                                          row.detailMessage == "" ? <Fragment/> :
                                            <Button className="description" iconDescription="more" size="small" kind="ghost" onClick={() => this.ShowDetailPanel(row.detailMessage)}>more...</Button>
                                        }
                                    </div>
                                )
                            })
                        }
                    </div>
                    <DetailPanel show={this.state.revealDetail} messageText={this.state.detailMessage} />
                    <div className="actions">
                        <Button iconDescription="Continue" onClick={() => this.handleContinueClick()}>Continue</Button>
                    </div>
                </div>
            </Fragment>
        )
    }
}

// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectCapabilities: stores.projectCapabilitiesReducer,
    }
};

CapabilitiesPanel.propTypes = {
    projectID: PropTypes.string.isRequired,
    handleCapabilitiesClose: PropTypes.func.isRequired,
}

export default connect(mapStateToProps)(CapabilitiesPanel);

