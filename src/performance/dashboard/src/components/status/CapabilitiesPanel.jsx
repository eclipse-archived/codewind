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
import {Button} from 'carbon-components-react';
import IconSuccess from '@carbon/icons-react/es/checkmark/20';
import IconFailure from '@carbon/icons-react/es/error/20';
import { connect } from 'react-redux';

import { fetchProjectCapabilities } from '../../store/actions/projectCapabilitiesActions';
import './CapabilitiesPanel.scss';

class CapabilitiesPanel extends React.Component {

    constructor() {
        super();
        this.state = {
            lastUpdated: "",
            doNotShowAgain: false,
         };
        this.buildDisplayModel = this.buildDisplayModel.bind(this);
        this.handleContinueClick = this.handleContinueClick.bind(this);
    }

    componentDidMount() {
        if (!this.props.projectID) { return; }
        this.props.dispatch(fetchProjectCapabilities(this.props.projectID));
    }

    componentWillReceiveProps(newProps) {
        if (newProps.projectCapabilities.lastUpdated !== this.state.lastUpdated) {
            this.setState({lastUpdated: newProps.projectCapabilities.lastUpdated})
        }
    }

    getIconMarkup(status) {
        if (status) {
            return <IconSuccess className='bx--btn__icon' style={{ 'fill': '#42be65'}} />
        }
        return <IconFailure className='bx--btn__icon' style={{ 'fill': '#da1e28' }} />
    }

    handleContinueClick() {
        this.setState({doNotShowAgain:true})
    }

    buildDisplayModel() {
        const displayModelTemplate= [
            {
                id:"ProjectStatus", label: "Project Status", status: false,
                textSuccess: "Your project has started and is running",
                textFailure: "Your project is not running"
            },
            {
                id:"LoadRunner", label: "LoadRunner Feature", status: false,
                textSuccess: "Codewind can apply load pressure to your project",
                textFailure:"Codewind is unable to apply load pressure your project"
            },
            {
                id:"LiveMetrics", label: "Live Metrics", status: false,
                textSuccess: "Your project has built in support for Live Metrics",
                textFailure:"Your project does not support Live Metrics collection. This feature requires additional monitoring to be enabled in your project. Open the project settings in your IDE and enable the Inject Metrics checkbox."
            },
            {
                id:"Comparisons", label: "Test Comparisons", status: false,
                textSuccess:"Ready",
                textFailure: "Your project does not support load run comparisons. This requires additional monitoring to be enabled in your project. To enable this feature, open the project settings in your IDE and enable the Inject Metrics checkbox.",
            },
            {
                id:"TimedComparisons", label: "Timed Load Tests", status: false,
                textSuccess: "Ready",
                textFailure:"Your project does not support the new timed load run comparisons feature. This requires updated monitoring to be enabled in your project. To enable this feature, open the project settings in your IDE and enable the Inject Metrics checkbox."
            },
            {
                id:"Profiling", label: "Hot methods", status: false,
                textSuccess: "Ready",
                textFailure:"Your project does not support hot method performance profiling. Only Java and NodeJS projects support this feature and require injected Appmetrics to be enabled."
            },
        ];

        const capabilityData = this.props.projectCapabilities.capabilities;

        // Update the UI model with API status
        let feature = displayModelTemplate.find(element => element.id == "ProjectStatus");
        feature.status = capabilityData.running

        console.log('capabilityData.capabilities', capabilityData.capabilities)


        // We always want to display all the rows in the UI model so update status with results from the capabilities API
        if (capabilityData.capabilities) {
            feature = displayModelTemplate.find(element => element.id == "LoadRunner");
            if (feature) feature.status = capabilityData.capabilities.loadrunner

            feature = displayModelTemplate.find(element => element.id == "LiveMetrics");
            if (feature) feature.status = capabilityData.capabilities.liveMetrics

            feature = displayModelTemplate.find(element => element.id == "Comparisons");
            if (feature)  feature.status = capabilityData.capabilities.metricsCollections

            feature = displayModelTemplate.find(element => element.id == "TimedComparisons");
            if (feature)  feature.status = capabilityData.capabilities.metricsCollectionsTimed

            feature = displayModelTemplate.find(element => element.id == "Profiling");
            if (feature)  feature.status = capabilityData.capabilities.profiling
        }

        return displayModelTemplate;
    }

    render() {
        if (this.state.doNotShowAgain) return <Fragment/>
        const dataModel = this.buildDisplayModel();
        return (
            <Fragment>
                <div className="Capabilities">
                    <div className="bannerPanel">
                        <div className="panelTitle">
                            Project capabilities
                        </div>
                        <div className="panelSubTitle">
                            Monitoring and performance measuring features available to you are:
                        </div>
                    </div>
                    <div className="rows">
                    {
                        dataModel.map(row => {
                            return (
                            <div className="row">
                                <div className="headline">
                                    <div className="icon">{this.getIconMarkup(row.status)}</div>
                                    <div className="capability">{row.label}</div>
                                </div>
                                <div className="description">{row.status ? row.textSuccess : row.textFailure}</div>
                            </div>
                            )
                        })
                    }
                    </div>

                <div className="actions">
                    <Button onClick={() => this.handleContinueClick()}>Continue</Button>
                </div>
              </div>
            </Fragment>
        )
    }
}

CapabilitiesPanel.propTypes = {
    projectID: PropTypes.string.isRequired,
};

// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectCapabilities: stores.projectCapabilitiesReducer,
    }
};

CapabilitiesPanel.propTypes = {
    projectID: PropTypes.string.isRequired
}

export default connect(mapStateToProps)(CapabilitiesPanel);

