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

import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import IconUp from '@carbon/icons-react/es/arrow--up/16'
import IconDown from '@carbon/icons-react/es/arrow--down/16'
import IconEven from '@carbon/icons-react/es/subtract/20'
import { TooltipIcon } from 'carbon-components-react'
import MetricsUtils from '../../modules/MetricsUtils'
import DescriptionEditor from './DescriptionEditor'
import './ResultsCard.scss'

export default class ResultsCard extends Component {
    render() {
        const { title, snapshot, snapshotPrevious } = this.props;

        if (!snapshot) {
            return <Fragment />
        }

        const counterKeys = MetricsUtils.getLanguageCounters(this.props.projectLanguage);

        let cpuValue = 0;
        let memoryValue = 0;
        let responseValue = 0;
        let cpuValuePrevious = 0;
        let memoryValuePrevious = 0;
        let responseValuePrevious = 0;
        let cpuDelta = 0;
        let memoryDelta = 0;
        let responseDelta = 0;

        try {
            cpuValue = ((snapshot.cpu.value.value.data[counterKeys.CPU_PROCESS_MEAN]) * 100).toFixed(0);
            cpuValuePrevious = ((snapshotPrevious.cpu.value.value.data[counterKeys.CPU_PROCESS_MEAN]) * 100).toFixed(0);
            cpuDelta = cpuValue - cpuValuePrevious;
        } catch (err) {
            console.log('Result card - No available CPU data');
        }

        try {
            memoryValue = (snapshot.memory.value.value.data[counterKeys.MEM_PROCESS_PEAK] / 1024 / 1024).toFixed(1);
            memoryValuePrevious = (snapshotPrevious.memory.value.value.data[counterKeys.MEM_PROCESS_PEAK] / 1024 / 1024).toFixed(1);
            memoryDelta = memoryValue - memoryValuePrevious;
        } catch (err) {
            console.log('Result card - No available memory data');
        }

        try {
            responseValue = snapshot.http.value.value.data.find(url_item => {
                return MetricsUtils.getPathFromURL(url_item.url) === this.props.absolutePath
            });
            if (responseValue) {
                responseValue = responseValue[counterKeys.HTTP_AVERAGE_RESPONSE].toFixed(1);
            }
            responseValuePrevious = snapshotPrevious.http.value.value.data.find(url_item => {
                return MetricsUtils.getPathFromURL(url_item.url) === this.props.absolutePath
            });
            if (responseValuePrevious) {
                responseValuePrevious = responseValuePrevious[counterKeys.HTTP_AVERAGE_RESPONSE].toFixed(1);
            }
            responseDelta = responseValue - responseValuePrevious;
        } catch (err) {
            console.log('Result card - No available HTTP response data');
        }

        let cpuTooltipText = '';
        let memoryTooltipText = '';
        let responseTooltipText = '';

        if (cpuDelta == 0) { cpuTooltipText = "No change in performance" } else {
            if (cpuDelta <= 0) { cpuTooltipText = "CPU usage reduced. Application performance has improved." } else {
                cpuTooltipText = "CPU usage increased. Application performance is worse.";
            }
        }
        if (memoryDelta == 0) { memoryTooltipText = "No change in performance" } else {
            if (memoryDelta <= 0) { memoryTooltipText = "Memory usage decreased. Application performance has improved" } else {
                memoryTooltipText = "Memory usage increased, application performance is worse.";
            }
        }
        if (responseDelta == 0) { responseTooltipText = "No change in performance" } else {
            if (responseDelta <= 0) { responseTooltipText = "Response time decreased. Application performance has improved" } else {
                responseTooltipText = "Response time increased. Application responded slower than before";
            }
        }

        return (
            <div className='ResultsCard'>
                <div className='metrics-container'>
                    <div className='metrics-title'>
                        <div className='label'>{title}</div>
                        <div className='datetime'> {new Date(snapshot.time).toLocaleString()}</div>
                    </div>
                </div>
                <div className='metrics-description'>
                    <DescriptionEditor projectID={this.props.projectID} text={snapshot.desc} snapshotTime={snapshot.time} alwaysShowEditIcon={true} />
                </div>
                <div className='metrics-container'>
                    <div className='metrics-types'>
                        <div>
                            {responseValue ?
                                <Fragment>
                                    <div className='metrics-value'>{responseValue}ms</div>
                                    <div className='metrics-type'>
                                        <div className='metrics-label'>Response</div>
                                        <div className='metrics-delta'>
                                            
                                            <TooltipIcon tooltipText={responseTooltipText} align="end" >
                                                {responseDelta > 0 ? <IconUp aria-label='Icon up' className='bx--btn__icon' /> : <Fragment />}
                                                {responseDelta === 0 ? <IconEven aria-label='Icon even' className='bx--btn__icon' /> : <Fragment />}
                                                {responseDelta < 0 ? <IconDown aria-label='Icon down' className='bx--btn__icon' /> : <Fragment />}
                                            </TooltipIcon>
                                        </div>
                                    </div>
                                </Fragment> : <Fragment />}
                        </div>

                        <div>
                            <div className='metrics-value'>{cpuValue}%</div>
                            <div className='metrics-type'>
                                <div className='metrics-label'>CPU</div>
                                <div className='metrics-delta'>
                                    <TooltipIcon tooltipText={cpuTooltipText} align="start" >
                                        {cpuDelta > 0 ? <IconUp aria-label="Icon up" className='bx--btn__icon' /> : <Fragment />}
                                        {cpuDelta === 0 ? <IconEven aria-label="Icon even" className='bx--btn__icon' /> : <Fragment />}
                                        {cpuDelta < 0 ? <IconDown aria-label="Icon down" className='bx--btn__icon' /> : <Fragment />}
                                    </TooltipIcon>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className='metrics-value'>{memoryValue}MB</div>
                            <div className='metrics-type'>
                                <div className='metrics-label'>Memory</div>
                                <div className='metrics-delta'>
                                    <TooltipIcon tooltipText={memoryTooltipText} align="center" direction="bottom">
                                        {memoryDelta > 0 ? <IconUp aria-label="Icon up" className='bx--btn__icon' /> : <Fragment />}
                                        {memoryDelta === 0 ? <IconEven aria-label="Icon even" className='bx--btn__icon' /> : <Fragment />}
                                        {memoryDelta < 0 ? <IconDown aria-label="Icon down" className='bx--btn__icon' /> : <Fragment />}
                                    </TooltipIcon>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        )
    }
}

ResultsCard.propTypes = {
    projectID: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    snapshot: PropTypes.object.isRequired,
    snapshotPrevious: PropTypes.object.isRequired,
    absolutePath: PropTypes.string.isRequired,
    projectLanguage: PropTypes.string.isRequired,
}