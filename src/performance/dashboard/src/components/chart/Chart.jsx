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

import MetricsUtils from '../../modules/MetricsUtils';
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
        this.buildChartData = this.buildChartData.bind(this);
        this.chartAxisTicksY = this.chartAxisTicksY.bind(this);
        this.getLineData = this.getLineData.bind(this);
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

    getLineData(counterName) {
        const { chartData } = this.props;
        const counterKeys = MetricsUtils.getLanguageCounters(this.props.projectLanguage);

        switch (counterName) {
            case 'CPU_PROCESS_MEAN':
                if (chartData.CPU.columns && chartData.CPU.columns.length > 0) {
                    const metricsRow = chartData.CPU.columns.find(metric => {
                        return metric[0] === counterKeys[counterName];
                    });
                    return metricsRow;
                }
                return [];
            case 'MEM_PROCESS_PEAK':
                if (chartData.MEMORY.columns && chartData.MEMORY.columns.length > 0) {
                    const metricsRow = chartData.MEMORY.columns.find(metric => {
                        return metric[0] === counterKeys["MEM_PROCESS_PEAK"];
                    });
                    return metricsRow;
                }
                return [];
            case 'HTTP_RESPONSE':
                if (chartData.HTTP.columns && chartData.HTTP.columns.length > 0) {
                    const metricsRow = chartData.HTTP.columns.find(metric => {
                        return MetricsUtils.getPathFromURL(metric[0]) === this.props.absolutePath;
                    });
                    return metricsRow;
                }
                return [];
            case 'HTTP_HITS':
                if (chartData.HTTPHits.columns && chartData.HTTPHits.columns.length > 0) {
                    const metricsRow = chartData.HTTPHits.columns.find(metric => {
                        return MetricsUtils.getPathFromURL(metric[0]) === this.props.absolutePath;
                    });
                    return metricsRow;
                }
                return [];
            default:
                return [];
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
        const lineString = this.getLineData(this.state.lastCounterSelected);
        if (lineString.length > 1) {
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
            const colorPattern = { pattern: ChartUtils.getColorPattern(["CPU_PROCESS_MEAN", "MEM_PROCESS_PEAK", "HTTP_RESPONSE", "HTTP_HITS"]) };

            // Re-render the entire chart using this base format
            this.chart = c3.generate({
                data: {
                    columns: [],
                    classes: [],
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
                color: colorPattern,
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

        const data = this.buildChartData();
        let lineNames = [];
        let colorPattern = [];

        // Add lines and colors
        if (data && data.columns.length > 0) {
            data.columns.forEach(line => {
                lineNames.push(line[0]);
            });
            const enabledCounters = (this.props.chartCounters && this.props.chartCounters.enabledCounters) ? this.props.chartCounters.enabledCounters : []
            colorPattern = { pattern: ChartUtils.getColorPatternFiltered(lineNames, enabledCounters) };
        }

        // Change chart properties
        if (this.chart) {
            this.chart.load({
                columns: data.columns,
                classes: data.classes
            })
            // Update labels
            this.chart.axis.labels({ y: this.state.lastCounterSelected });
            const enabledCounters = (this.props.chartCounters && this.props.chartCounters.enabledCounters) ? this.props.chartCounters.enabledCounters : []
            colorPattern = ChartUtils.getColorPatternLines(lineNames, enabledCounters);
            // Update colors
            this.chart.data.colors(colorPattern);
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
                console.err("Unable to render zoom extent", err);
            }
        }
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

    buildChartRow(metricsRow, counterName) {
        if (metricsRow) {
            try {
                const numbers = metricsRow.slice(1).map(value => { return parseInt(value) })
                const max = Math.max(...numbers);
                const percents = numbers.map(value => { return `${parseInt((value * 100) / max)}` });
                const categoryRow = [counterName].concat(percents);
                return categoryRow;
            } catch (err) {
                return [];
            }
        }
        return [];
    }


    buildChartData() {
        const { chartData } = this.props;
        const data = {
            columns: [],
            classes: [],
            selection: {
                enabled: true,
                grouped: true,
                multiple: true
            },
            types: ChartUtils.chartTypes,
        };

        const counterKeys = MetricsUtils.getLanguageCounters(this.props.projectLanguage);

        if (chartData.CPU.columns && chartData.CPU.columns.length > 0) {
            const metricsRow = chartData.CPU.columns.find(metric => {
                return metric[0] === counterKeys["CPU_PROCESS_MEAN"];
            });
            if (metricsRow) {
                const metricsRowClone = metricsRow.slice();
                data.columns.push(this.buildChartRow(metricsRowClone, "CPU_PROCESS_MEAN"));
                metricsRowClone[0] = "CPU_PROCESS_MEAN";
                data.classes.push(metricsRowClone);
            }
        }

        if (chartData.MEMORY.columns && chartData.MEMORY.columns.length > 0) {
            const metricsRow = chartData.MEMORY.columns.find(metric => {
                return metric[0] === counterKeys["MEM_PROCESS_PEAK"];
            });
            if (metricsRow) {
                const metricsRowClone = metricsRow.slice();
                data.columns.push(this.buildChartRow(metricsRowClone, "MEM_PROCESS_PEAK"));
                metricsRowClone[0] = "MEM_PROCESS_PEAK";
                data.classes.push(metricsRowClone);
            }
        }

        if (chartData.HTTP.columns && chartData.HTTP.columns.length > 0) {
            const metricsRow = chartData.HTTP.columns.find(metric => {
                return MetricsUtils.getPathFromURL(metric[0]) === this.props.absolutePath;
            });
            if (metricsRow) {
                const metricsRowClone = metricsRow.slice();
                data.columns.push(this.buildChartRow(metricsRowClone, "HTTP_RESPONSE"));
                metricsRowClone[0] = "HTTP_RESPONSE";
                data.classes.push(metricsRowClone);
            }
        }

        if (chartData.HTTPHits.columns && chartData.HTTPHits.columns.length > 0) {
            const metricsRow = chartData.HTTPHits.columns.find(metric => {
                return MetricsUtils.getPathFromURL(metric[0]) === this.props.absolutePath;
            });
            if (metricsRow) {
                const metricsRowClone = metricsRow.slice();
                data.columns.push(this.buildChartRow(metricsRowClone, "HTTP_HITS"));
                metricsRowClone[0] = "HTTP_HITS"
                data.classes.push(metricsRowClone);
            }
        }
        return data;
    }

    render() {
        const data = this.buildChartData();

        return (
            <div className="Chart">
                <div className="Chart_actionbar">
                    <div style={{ width: "300px", height: "35px" }}>
                    </div>
                </div>
                <div className="Chart_C3" style={{ padding: "20px" }} >
                    {
                        data.columns.length === 0 ?
                            <div className="nodata">
                                <div className="nodata_message">
                                    <div className="nodata_message_title">No metrics available</div>
                                    <div className="nodata_message_help">Tip: Run a new load test</div>
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
    projectLanguage: PropTypes.string.isRequired,
}

export default connect(mapStateToProps)(Chart);
