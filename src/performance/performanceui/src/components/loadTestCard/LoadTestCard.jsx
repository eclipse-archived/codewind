/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
#
* Contributors:
*     IBM Corporation - initial API and implementation
*******************************************************************************/

import React, { Fragment } from 'react'
import { Icon, Tooltip } from 'carbon-components-react';
import { iconCaretUp, iconCaretDown } from 'carbon-icons';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { iconChevronDown, iconChevronRight } from 'carbon-icons';
import { formatToISODate, formatToISOTime } from '../../utils/dateTime';
import MetricsUtils from '../../modules/MetricsUtils';
import { CHART_TYPE_CPU, CHART_TYPE_MEMORY, CHART_TYPE_HTTP } from '../../AppConstants'
import DescriptionEditor from './DescriptionEditor'
import DeleteTestAction from './actions/DeleteTestAction'
import BuildToolTipContent from './TestCardTooltips';
import BuildToolTipHTTP from './TestCardTooltipHTTP';

import './LoadTestCard.scss'

class LoadTestCard extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            showModalDelete: false,
            isExpanded: false,
        }
    }

    handleToggleExpanded() {
        this.setState({ isExpanded: !this.state.isExpanded });
    }

    // eslint-disable-next-line class-methods-use-this
    renderDeltaIcon(deltaAmount) {
        let iconColor = (deltaAmount < 0) ? '#397235' : '#CC0000';
        let iconStyle = (deltaAmount < 0) ? iconCaretDown : iconCaretUp;
        let iconDescription = deltaAmount;
        return (!deltaAmount) ? <Fragment /> : <Icon height='16' width='16' fill={iconColor} icon={iconStyle} label='' description={`Difference: ${iconDescription}`} />
    }

    render() {

        const { plotpoint, snapshot } = this.props;
        
        /* retrieve the counter values */
        const cpuValue = snapshot[CHART_TYPE_CPU].value.value.data['processMean'];
        const memoryValue = snapshot[CHART_TYPE_MEMORY].value.value.data['usedNativePeak'];
        const httpValue = MetricsUtils.getURLAverageResponseTime(snapshot[CHART_TYPE_HTTP].value.value.data, this.props.urlFilter);

        /* retrieve the delta values */
        const cpuDelta = (snapshot['cpu'].value.value.delta) ?
            snapshot['cpu'].value.value.delta['processMean'] : 0

        const memoryDelta = (snapshot['memory'].value.value.delta) ?
            snapshot['memory'].value.value.delta['usedNativePeak'] : 0

        const httpDelta = (snapshot['http'].value.value.delta) ?
            snapshot['http'].value.value.delta['averageResponseTime'] : 0

        /* format the values for display */
        let cpuFormatted = (cpuValue * 100).toFixed();
        let memoryFormatted = (memoryValue * (1 / 1024 / 1024)).toFixed();
        let httpFormatted = (httpValue * 1).toFixed(2);

        if (isNaN(cpuFormatted)) cpuFormatted = 0;
        if (isNaN(memoryFormatted)) memoryFormatted = 0;
        if (isNaN(httpFormatted)) httpFormatted = 0;

        let toolTipContentCPU = BuildToolTipContent(snapshot['cpu'].value.value.data, 'CPU', 100, 0, '%');
        let toolTipContentMemory = BuildToolTipContent(snapshot['memory'].value.value.data, 'MEMORY', (1 / 1024 / 1024), 1, "MB");
        let toolTipContentHTTP = BuildToolTipHTTP(snapshot['http'].value.value.data, this.props.urlFilter);


        return (
            <div className={this.state.isExpanded ? "LoadTestCard expanded" : "LoadTestCard "}>
                <div className="toolbar">
                    <DeleteTestAction snapshot={this.props.snapshot} />
                    <Icon className="icon" description="Expand/Collapse" style={{ marginLeft: '5px', 'width': '16px' }} onClick={() => this.handleToggleExpanded()} icon={(this.state.isExpanded) ? iconChevronDown : iconChevronRight} iconTitle="Expand/Collapse" />
                </div>
                <div className="basics">
                    <div className="title">Test {plotpoint}</div>
                    <div className="time">
                        <span className="testDate">{formatToISODate(snapshot.time)}</span>
                        <span className="testSpacer"> | </span >
                        <span className="testTime">{formatToISOTime(snapshot.time)}</span>
                    </div>
                </div>
                <div className="details">
                    <div className={this.state.isExpanded ? "details" : "details hidden"}>
                        <div className="description">
                            <DescriptionEditor descriptionText={snapshot.desc ? snapshot.desc : ''} snapshotTime={snapshot.time} />
                        </div>
                        <table className='detailsTable'>
                            <tbody>
                                <tr>
                                    <th><Tooltip clickToOpen direction='top' triggerText='CPU (%)'>{toolTipContentCPU}</Tooltip></th>
                                    <th><Tooltip clickToOpen direction='left' triggerText='Response (ms)' className='largeTooltip' >{toolTipContentHTTP}</Tooltip></th>
                                    <th><Tooltip clickToOpen direction='left' triggerText='Memory (MB)'>{toolTipContentMemory}</Tooltip></th>
                                </tr>
                                <tr>
                                    <td>{cpuFormatted} {this.renderDeltaIcon(cpuDelta)}</td>
                                    <td>{httpFormatted} {this.renderDeltaIcon(httpDelta)}</td>
                                    <td>{memoryFormatted} {this.renderDeltaIcon(memoryDelta)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    }
}

LoadTestCard.propTypes = {
    plotpoint: PropTypes.number.isRequired,
    snapshot: PropTypes.object,
    urlFilter: PropTypes.string.isRequired,  // only show this endpoint URL eg  / or /myapi
};


// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectMetricTypes: stores.projectMetricTypesReducer,
        projectMetrics: stores.projectMetricsReducer,
        lang: stores.localeReducer.lang
    };
};

export default connect(mapStateToProps)(LoadTestCard);
