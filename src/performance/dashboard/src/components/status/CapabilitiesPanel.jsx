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
import { Button, InlineLoading } from 'carbon-components-react';
import IconSuccess from '@carbon/icons-react/es/checkmark--outline/20';
import IconFailure from '@carbon/icons-react/es/error--outline/16';
import IconWarning from '@carbon/icons-react/es/warning/20';
import IconClose from '@carbon/icons-react/es/close/20';
import { showCapabilitiesPanel } from '../../store/actions/navbarActions';

import { connect } from 'react-redux';
import * as Constants from './Constants';
import DetailPanel from './DetailPanel';

import { fetchProjectCapabilities } from '../../store/actions/projectCapabilitiesActions';
import './CapabilitiesPanel.scss';

class CapabilitiesPanel extends React.Component {

    constructor() {
        super();
        this.state = {
            lastProjectUpdateTime: 0,
            lastUpdated: 0,
            detailMessage:"",
            detailSubComponent:"",
            revealDetail:false,
        };
        this.buildDisplayModel = this.buildDisplayModel.bind(this);
        this.handleCloseClick = this.handleCloseClick.bind(this);
    }

    async componentDidMount() {
        if (!this.props.projectID) return;
        try {
            await this.props.dispatch(fetchProjectCapabilities(localStorage.getItem('cw-access-token'), this.props.projectID))
        } catch (err) {
            console.log("Error loading capabilities: ", err)
        }
    }

    componentWillReceiveProps(newProps) {
        if (newProps.projectCapabilities.receivedAt !== this.state.lastUpdated) {
            this.setState({ lastUpdated: newProps.projectCapabilities.receivedAt })
        }
        if (newProps.projectInfo.receivedAt !== this.state.lastUpdated) {
            this.setState({ lastProjectUpdateTime: newProps.projectInfo.receivedAt })
        }
    }

    getIconMarkup(status) {
        switch (status) {
            case Constants.STATUS_OK:
                return <IconSuccess className='bx--btn__icon' style={{ 'fill': '#42be65' }} />
            case Constants.STATUS_ERROR:
                return <IconFailure className='bx--btn__icon' style={{ 'fill': '#da1e28' }} />
            case Constants.STATUS_BUSY:
                return <div style={{ display: 'inline-block', verticalAlign: "middle" }}><InlineLoading /></div>
        }
        return <IconWarning style={{ 'fill': '#f1c21b' }} />
    }

    handleCloseClick() {
        this.props.dispatch(showCapabilitiesPanel(false));
    }

    getCapabilityProjectStatus(capabilityData, feature) {
        switch (this.props.projectInfo.config.appStatus) {
            case 'starting': {
                feature.status = Constants.STATUS_BUSY;
                feature.statusMessage = Constants.MESSAGE_PROJECT_STARTING;
                break;
            }
            case 'started': {
                feature.status = Constants.STATUS_OK;
                feature.statusMessage = Constants.MESSAGE_PROJECT_RUNNING;
                break;
            }

            case 'stopping': {
                feature.status = Constants.STATUS_WARNING;
                feature.statusMessage = Constants.MESSAGE_PROJECT_STOPPING;
                break;
            }

            default: {
                feature.status = Constants.STATUS_ERROR;
                feature.statusMessage = Constants.MESSAGE_PROJECT_NOT_RUNNING;
            }
        }
    }

    getCapabilityLoadRunnerStatus(capabilityData, feature) {
            feature.status = Constants.STATUS_OK
            feature.statusMessage = Constants.MESSAGE_LOADRUNNER_AVAILABLE;

    }

    getCapabilityLiveMetrics(capabilityData, feature) {

        // When the project is not running we can not determine if it supports live metrics
        if (this.props.projectInfo.config.appStatus !=='running' && !this.props.projectInfo.config.host) {
            feature.status = Constants.STATUS_WARNING
            feature.statusMessage = Constants.MESSAGE_LIVEMETRICS_PROJECT_NOT_RUNNING;
            return
        }

        // Show the re-enable auth button
        if (capabilityData.microprofilePackageAuthenticationDisabled) {
            feature.status = Constants.STATUS_OK
            feature.statusMessage = Constants.MESSAGE_LIVEMETRICS_MICROPROFILE_ISDISABLED;
            feature.detailSubComponent = Constants.MESSAGE_COMPONENT_LIVEMETRICS_MICROPROFILE_ENABLE_AUTH;
            return
        }

        // If live metrics is enabled - everything is good
        if (capabilityData.liveMetricsAvailable) {
            feature.status = Constants.STATUS_OK
            feature.statusMessage = Constants.MESSAGE_LIVEMETRICS_AVAILABLE;
            return
        }

        // Show the MP disable auth button
         if (capabilityData.microprofilePackageFoundInBuildFile) {
            feature.status = Constants.STATUS_WARNING
            feature.statusMessage = Constants.MESSAGE_LIVEMETRICS_MICROPROFILE;
            feature.detailSubComponent = Constants.MESSAGE_COMPONENT_LIVEMETRICS_MICROPROFILE_DISABLE_AUTH;
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

    getCapabilityBenchmarks(capabilityData, feature) {
 
        if (capabilityData.appmetricsEndpoint && !capabilityData.hasTimedMetrics) {
            feature.status = Constants.STATUS_WARNING;
            feature.statusMessage = Constants.MESSAGE_COMPARISONS_INJECT_TIMED
            return
        }

        if (capabilityData.appmetricsEndpoint) {
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
                statusMessage: "Unable to determine status", detailMessage:"", detailSubComponent:"",
            },
            {
                id: "LoadRunner", label: "Run Load Feature", status: Constants.STATUS_WARNING,
                statusMessage: "Unable to determine status", detailMessage:"", detailSubComponent:"",
            },
            {
                id: "LiveMetrics", label: "Live Monitoring", status: Constants.STATUS_WARNING,
                statusMessage: "Unable to determine status", detailMessage:"", detailSubComponent:"",
            },
            {
                id: "Comparisons", label: "Benchmarks", status: Constants.STATUS_WARNING,
                statusMessage: "Unable to determine status", detailMessage:"", detailSubComponent:"",
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
            this.getCapabilityBenchmarks(capabilityData, feature);
        }
        return displayModelTemplate;
    }

    ShowDetailPanel(detailMessage, detailSubComponent) {
        if (detailMessage != this.state.detailMessage || detailSubComponent != this.state.detailSubComponent) {
            this.setState({revealDetail: true, detailMessage:detailMessage, detailSubComponent:detailSubComponent});
        } else {
            this.setState({revealDetail: false, detailMessage:"", detailSubComponent:""});
        }
    }

    render() {
        const dataModel = this.buildDisplayModel();
        const fetching = this.props.projectCapabilities.fetching;
        return (
            <Fragment>
                <div className="Capabilities">
                    <div className="actions">
                        <Button aria-label="Close panel" className="closeButton" kind="ghost" size="small" renderIcon={IconClose} iconDescription="Close capabilities panel" onClick={() => this.handleCloseClick()}/>
                    </div>
                    <div className="rows" role="grid">
                        {
                            dataModel.map(row => {
                                return (
                                    <div key={row.id} className="row " role="gridcell">
                                        <Fragment>
                                            <div className="headline">
                                                <div className="icon">
                                                    { this.getIconMarkup(row.status) }
                                                </div>
                                                <div className={row.status!= Constants.STATUS_BUSY ? 'capability' : 'capability_nomargin'}>
                                                    { row.label }
                                                </div>
                                            </div>
                                            <div className="description">
                                                { row.statusMessage }
                                            </div>
                                        </Fragment>
                                        {
                                          (row.detailMessage == "" && row.detailSubComponent == "") || fetching ? <Fragment/> :
                                          <DetailPanel show={true} projectID={this.props.projectID} messageText={row.detailMessage} detailSubComponent={row.detailSubComponent}/>
                                        }
                                    </div>
                                )
                            })
                        }
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
        projectInfo: stores.projectInfoReducer,
        navbarActions: stores.navbarActionsReducer,
    }
};

CapabilitiesPanel.propTypes = {
    projectID: PropTypes.string.isRequired,
}

export default connect(mapStateToProps)(CapabilitiesPanel);

