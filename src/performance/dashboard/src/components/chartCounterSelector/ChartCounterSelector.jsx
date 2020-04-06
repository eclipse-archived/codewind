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

import React, { Component, Fragment } from 'react';
import { Checkbox, Button, Tooltip, TooltipDefinition } from 'carbon-components-react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import IconLine from '@carbon/icons-react/es/subtract/32';
import IconInfo from '@carbon/icons-react/es/information/16';
import IconLaunch from '@carbon/icons-react/es/launch/16';
import { countersSet } from '../../store/actions/chartCounterActions';

import './ChartCounterSelector.scss';
class ChartCounterSelector extends Component {

    constructor() {
        super();
        this.handleExpandClick = this.handleExpandClick.bind(this);
        this.isCounterEnabled = this.isCounterEnabled.bind(this);
    }

    componentDidMount() {
        const component = this;
        // give the chart time to draw before selecting a counter
        setTimeout(() => {
            component.handleExpandClick({ target: { checked: true } }, "HTTP_RESPONSE");
        }, 1500)
    }

    /**
     * @param key fieldID
     * @param counterName the metrics counter name
     */
    handleExpandClick(key, counterName) {

        let newEntry = {
            'name': counterName,
            'checked': key.target.checked
        }
        let clonedCounters = Object.assign(this.props.chartCounters.enabledCounters);
        let target = clonedCounters.find(counter => {
            return counter.name === newEntry.name;
        })
        if (target) {
            target.checked = newEntry.checked;
        } else {
            clonedCounters.push(newEntry);
        }
        this.props.dispatch(countersSet(clonedCounters));
    }

    getColor(key) {
        const chart_swatches = [
            { 'name': 'CPU_PROCESS', 'rgb_on': '#95d13c', 'rgb_off': '#333' },
            { 'name': 'MEM_PROCESS_PEAK', 'rgb_on': '#0094e5', 'rgb_off': '#333' },
            { 'name': 'HTTP_RESPONSE', 'rgb_on': '#fa4abf', 'rgb_off': '#333' },
            { 'name': 'HTTP_HITS', 'rgb_on': '#a36df4', 'rgb_off': '#333' },
        ]
        return chart_swatches.find(x => x.name === key).rgb_on
    }

    handleClearSelections() {
        this.props.dispatch(countersSet([]));
    }

    isCounterAvailable(chartData, counterName) {
        return (chartData && chartData[counterName] && chartData[counterName].columns && chartData[counterName].columns.length > 1);
    }

    isCounterEnabled(counterName) {
        const foundCounter = this.props.chartCounters.enabledCounters.find(counter => {
            return counter.name === counterName
        });
        if (foundCounter) {
            return foundCounter.checked;
        }
        return false;
    }

    render() {
        const { chartData, showTip } = this.props;

        // 1. Only display the counter categories if they exist
        // 2. The counters must match the AbsolutePath load runner filter
        const hasHits = this.isCounterAvailable(chartData, "HTTPHits");
        const hasResponse = hasHits && this.isCounterAvailable(chartData, "HTTP");
        const hasCPU = hasHits && this.isCounterAvailable(chartData, "CPU");
        const hasMemory = hasHits && this.isCounterAvailable(chartData, "MEMORY");

        // no matching metrics available
        if (showTip || !(hasHits && hasResponse && hasCPU && hasMemory)) {
            return (
                <div className='ChartCounterSelector' >
                    <div className='nodata-container' >
                        <div className='innerContainer'>
                            <div className="chartCategory">
                                <div className="categoryLabels">
                                    <Checkbox id="placeholderResp" disabled={true} checked={false} labelText='Response (ms)' />
                                </div>
                            </div>
                            <div className="chartCategory">
                                <div className="categoryLabels">
                                    <Checkbox id="placeholderHits" disabled={true} checked={false} labelText='Hits' />
                                </div>
                            </div>
                            <div className="chartCategory">
                                <div className="categoryLabels">
                                    <Checkbox id="placeholderCPU" disabled={true} checked={false} labelText='CPU (%)' />
                                </div>
                            </div>
                            <div className="chartCategory">
                                <div className="categoryLabels">
                                    <Checkbox id="placeholderMem" disabled={true} checked={false} labelText='Memory (MB)' />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }

        return (
            <div className='ChartCounterSelector' >
                <div className="reset">
                    <Button small kind="ghost" onClick={() => this.handleClearSelections()}>Clear selections</Button>
                </div>
                <div className="innerContainer">

                    {hasResponse ?
                        <div className="chartCategory">
                            <div className="categoryLabels">
                                <Checkbox id="response" checked={this.isCounterEnabled('HTTP_RESPONSE')} onClick={(e) => this.handleExpandClick(e, "HTTP_RESPONSE")} labelText='Response (ms)' />
                            </div>
                            <div className="options expanded">
                                <div className='option'>
                                    <IconLine className='bx--btn__icon' style={{ 'fill': this.getColor('HTTP_RESPONSE') }} />
                                    <input readonly  aria-required="false" type="text" className="scrollableTextField" value={this.props.testPath}/>   
                                </div>
                            </div>
                        </div>
                        :
                        <Fragment />
                    }

                    {hasHits ?
                        <div className="chartCategory">
                            <div className="categoryLabels">
                                <Checkbox id="hits" checked={this.isCounterEnabled('HTTP_HITS')} onClick={(e) => this.handleExpandClick(e, 'HTTP_HITS')} labelText='Hits' />
                            </div>
                            <div className="options expanded">
                                <div className='option'>
                                    <IconLine className='bx--btn__icon' style={{ 'fill': this.getColor('HTTP_HITS') }} />
                                    <span className='label'>
                                    <input readonly  aria-required="false" type="text" className="scrollableTextField" value={this.props.testPath}/>                      
                                    </span>
                                </div>
                            </div>
                        </div>
                        :
                        <Fragment />
                    }
                    {hasCPU ?
                        <div className="chartCategory">
                            <div className="categoryLabels">
                                <Checkbox id="cpu" checked={this.isCounterEnabled('CPU_PROCESS_MEAN')} onClick={(e) => this.handleExpandClick(e, 'CPU_PROCESS_MEAN')} labelText='CPU (%)' />
                                <Tooltip
                                    showIcon={true}
                                    direction="left"
                                    iconDescription="Helpful Information"
                                    tabIndex={0}
                                    renderIcon={IconInfo}>
                                    <div>
                                        <p>
                                            Process CPU is the amount of CPU used by your project
                                    </p>
                                        <br />
                                        <p>
                                            If the process usage is low but the system usage is high, something other than your project is using up CPU resources.
                                    </p>

                                        <div className="bx--tooltip__footer">
                                            <a href="https://microclimate.dev/appmetrics#understanding-performance-metrics-in-the-dashboard-tab" className="bx--link" target="_blank" rel="noopener noreferrer">
                                                Learn More  <IconLaunch className='bx--btn__icon' />
                                            </a>
                                        </div>
                                    </div>
                                </Tooltip>
                            </div>
                            <div className="options expanded">
                                <div className='option'>
                                    <IconLine className='bx--btn__icon' style={{ 'fill': this.getColor('CPU_PROCESS') }} />
                                    <TooltipDefinition tooltipText="CPU used by application" align="end" >
                                        Process
                                    </TooltipDefinition>
                                </div>
                            </div>
                        </div>
                        :
                        <Fragment />
                    }

                    {hasMemory ?
                        <div className="chartCategory">
                            <div className="categoryLabels">
                                <Checkbox id="memory" checked={this.isCounterEnabled('MEM_PROCESS_PEAK')} onClick={(e) => this.handleExpandClick(e, 'MEM_PROCESS_PEAK')} labelText='Memory (MB)' />
                            </div>
                            <div className="options expanded">
                                <div className='option'>
                                    <IconLine className='bx--btn__icon' style={{ 'fill': this.getColor('MEM_PROCESS_PEAK') }} />
                                    <TooltipDefinition tooltipText="Process memory (Peak)" align="end" >
                                        Process
                                    </TooltipDefinition>
                                </div>
                            </div>
                        </div>
                        :
                        <Fragment />
                    }
                </div>
            </div>
        )
    }
}

// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        chartCounters: stores.chartCountersReducer
    };
};

ChartCounterSelector.propTypes = {
    testPath: PropTypes.string.isRequired,
    showTip: PropTypes.bool,    // Display tip (no metrics available)
    chartData: PropTypes.object   // ChartData
}

export default connect(mapStateToProps)(ChartCounterSelector);
