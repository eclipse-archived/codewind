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
import c3 from 'c3';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { buildChartData, getLineData } from './ChartBuilder';
import ChartUtils from './ChartUtils';
import 'c3/c3.css';
import './Chart.scss';

class Chart extends Component {

    constructor(props) {
        super(props);
        this.state = {
            absolutePath: '',
            enabledCounters: '',
            lastCounterSelected: ''
        }
        this.chartAxisTicksY = this.chartAxisTicksY.bind(this);
        this.chart = null;
    }

    componentDidMount() {
        this.updateChart();
    }

    componentWillReceiveProps(nextProps) {
        // If absolute path changed redraw the entire chart
        if (this.state.absolutePath !== nextProps.absolutePath) {
            this.setState({ absolutePath: nextProps.absolutePath });
        }

        // did we receive an updated list of enabledCounters
        if (nextProps.chartCounters.enabledCounters !== this.state.enabledCounters) {
            const tempCounters = [];
            // extract just the checked ones
            nextProps.chartCounters.enabledCounters.forEach(counter => {
                if (counter.checked) {
                    tempCounters.push(counter.name);
                }
            });

            // compare the enabledCounters previous with the new tempCounters list to determine what was added
            let difference = tempCounters.filter(x => !this.state.enabledCounters.includes(x));

            // set the lastCounterSelected to the difference 
            if (difference.length > 0) {
                this.setState({ lastCounterSelected: difference[0] });
            } else {
                this.setState({ lastCounterSelected: tempCounters[0] });
            }
            this.setState({ enabledCounters: tempCounters });
        }
    }

    /** 
     * Calculate and return the labels for the Y axis
     * param d : line value (0,25,50,75,100)
     */
    chartAxisTicksY(d) {

        function formatValue(value, factor) {
            if (value < 10) {
                return `${parseFloat(value * factor).toFixed(1)}`;
            }
            return `${parseInt(value * factor)}`;
        }

        if (!this.state.lastCounterSelected || this.state.lastCounterSelected === '') {
            return '';
        }

        const lineString = getLineData(this.props.chartData, this.state.lastCounterSelected, this.props.projectLanguage, this.props.absolutePath);
        if (lineString && lineString.length > 1) {
            const values = lineString.slice(1);
            const lineNumbers = values.map(element => { return parseFloat(element) })
            const largestValue = Math.max(...lineNumbers);
            switch (d) {
                case 25: {
                    return formatValue(largestValue, 0.25);
                }
                case 50: {
                    return formatValue(largestValue, 0.5);
                }
                case 75: {
                    return formatValue(largestValue, 0.75);
                }
                case 100: {
                    return formatValue(largestValue, 1);
                }
                default: {
                    return `${d}`;
                }
            }
        }
        return '';
    }

    componentDidUpdate() {
        if (!this.chart) {

            // Re-render the entire chart using this base format
            this.chart = c3.generate({
                data: {
                    columns: [],
                    classes: [],
                    colors: ChartUtils.getColorPattern(["CPU_PROCESS_MEAN", "MEM_PROCESS_PEAK", "HTTP_RESPONSE", "HTTP_HITS"]),
                    selection: {
                        enabled: true,
                        grouped: false,
                        multiple: false
                    },
                    types: ChartUtils.chartTypes
                },
                bindto: '#c3ChartComponent',
                grid: {
                    x: {
                        show: true
                    },
                    y: {
                        show: true,
                        class: 'gridline-y'
                    }
                },
                axis: {
                    y: {
                        show: true,
                        max: 100,
                        min: 0,
                        padding: { top: 5, bottom: 5 },
                        tick: {
                            values: [0, 25, 50, 75, 100],
                            multiline: true,
                            count: 5,
                            format: this.chartAxisTicksY
                        },
                        label: {
                            position: 'inner-middle'
                        }
                    },
                    x: {
                        show: true,
                        padding: { left: 0 },
                        tick: {
                            multiline: true,
                            multilineMax: 2
                        },
                        label: {
                            text: 'Snapshot #',
                            position: 'inner-right'
                        }
                    }
                },
                point: { r: 5, select: { r: 12 }, focus: { expand: { r: 7 } } },
                zoom: {
                    enabled: true,
                    type: 'scroll'
                },
                legend: {
                    show: false
                },
                size: {
                    height: 370
                },
                padding: {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 50
                },
                subchart: { show: true },
                tooltip: {
                    show: true,
                    contents: this.chartTooltipContainer
                }
            });
        }
        this.updateChart();
    }

    updateChart() {
        if (!this.chart) return;

        const data = buildChartData(this.props.chartData, this.props.projectLanguage, this.props.absolutePath);

        // Change chart properties
        if (this.chart) {
            this.chart.axis.labels({ y: this.state.lastCounterSelected });
            this.chart.load({
                columns: data.columns,
                classes: data.classes
            })

            const enabledCounters = (this.props.chartCounters && this.props.chartCounters.enabledCounters) ? this.props.chartCounters.enabledCounters : []

            // focus on selected ids:
            const checkedCounters = enabledCounters.filter(counter => counter.checked);
            let enabledCounterNames = checkedCounters.map(counter => {
                return counter.name
            });

            this.chart.focus(enabledCounterNames);

            // Update zoom extent
            try {
                const currentZoom = this.chart.zoom();
                if (data.columns[0] && data.columns[0].length > 5) {
                    if (currentZoom[0] === 0 && currentZoom[1] > data.columns[0].length - 2) {
                        this.chart.zoom([0.1, data.columns[0].length - 2]);
                    }
                }
            } catch (err) {
                // unable to show zoom extent
                console.error("Unable to render zoom extent", err);
            }
        }
    }

    /**
     * Determine if there is data available to plot on the chart
     */
    isDataAvailable(dataBundle) {
        try {
            if (dataBundle && dataBundle.columns && dataBundle.columns.length > 0 && dataBundle.columns[0].length > 1) {
                return true;
            }
        } catch (err) {
            console.error(`Unable to check for available data. ${err}`)
            return false;
        }
        return false;
    }

    /**
     * Builds a tooltip which displays the real data rather than the normalized data
     * @param {*} d 
     * @param {*} defaultTitleFormat 
     * @param {*} defaultValueFormat 
     * @param {*} color
     */
    chartTooltipContainer(d, defaultTitleFormat, defaultValueFormat, color) {
        const data = this.config.data_classes;
        const getDataValue = function (entry) {
            let value = data.find(row => { return row[0] === entry.id })
            if (value) {
                return value[entry.x + 1];
            }
            return "";
        }
        let toolTipHTML = '<div class="chartTooltip">';
        d.forEach(chartColumn => {
            toolTipHTML = toolTipHTML.concat(`${defaultTitleFormat(ChartUtils.counterLabels[chartColumn.name])}: ${defaultValueFormat(getDataValue(chartColumn))}${ChartUtils.counterUnits[chartColumn.name]} <br/>`);
        })
        toolTipHTML = toolTipHTML.concat('</div>')
        return toolTipHTML;
    }

    render() {
        const data = buildChartData(this.props.chartData, this.props.projectLanguage, this.props.absolutePath);
        const testPath = `Path: ${this.props.absolutePath}`;
        const hasData = this.isDataAvailable(data);

        return (
            <div className="Chart">
                <div className="Chart_actionbar">
                    <div style={{ width: "300px", height: "35px" }}>
                        {
                            (hasData) ?
                                <span className="testPath">{testPath}</span>
                                : <Fragment />
                        }
                    </div>
                </div>
                <div className="Chart_C3" style={{ padding: "20px" }} >
                    {
                        (!hasData) ?
                            <div className="nodata">
                                <div className="nodata_message">
                                    <div className="nodata_message_title">No metrics available</div>
                                    <div className="nodata_message_help">Tip: Run a few load tests</div>
                                </div>
                            </div>
                            : <Fragment />
                    }

                    <div id="c3ChartComponent"></div>

                </div>
                <div className="spacer-container"></div>
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

Chart.propTypes = {
    chartData: PropTypes.object.isRequired,
    absolutePath: PropTypes.string.isRequired,
    httpMethod: PropTypes.string.isRequired,
    projectLanguage: PropTypes.string.isRequired,
}

export default connect(mapStateToProps)(Chart);
