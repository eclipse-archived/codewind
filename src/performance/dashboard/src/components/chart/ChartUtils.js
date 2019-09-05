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

const colorSwatches = {
    CPU_PROCESS_MEAN: '#95d13c',
    MEM_PROCESS_PEAK: '#0094e5',
    HTTP_RESPONSE: '#FA4ABF',
    HTTP_HITS: '#A36DF4'
}

const chartTypes = {
    CPU_PROCESS_MEAN: 'line',
    MEM_PROCESS_PEAK: 'line',
    HTTP_RESPONSE: 'line',
    HTTP_HITS: 'line'
}

const counterLabels = {
    CPU_PROCESS_MEAN: 'CPU',
    MEM_PROCESS_PEAK: 'Memory',
    HTTP_RESPONSE: 'HTTP Response',
    HTTP_HITS: 'HTTP Hits'
}

const counterUnits = {
    CPU_PROCESS_MEAN: '%',
    MEM_PROCESS_PEAK: 'MB',
    HTTP_RESPONSE: 'ms',
    HTTP_HITS: ''
}

/**
 * Given an array of counters, return the list of chart colors
 */
let getColorPattern = function (counters) {
    var chartColors = {};
    counters.forEach(counterkey => {
        chartColors[counterkey] = colorSwatches[counterkey];
    });
    return chartColors;
}

/**
 * Given an array of counters, returns color codes based on the enabled status
 */
let getColorPatternLines = function (counters, counterStatus) {
    var chartColors = {};
    counters.forEach(counterKey => {
        let colorValue = "#555";
        // check if the counter is enabled, if its not,  set the color to grey

        const counterElement = counterStatus.find(counter => {
            return counter.name === counterKey;
        });

        if (counterElement && counterElement.checked) {
            colorValue = colorSwatches[counterKey];
        }

        chartColors[counterKey] = colorValue;
    });
    return chartColors;
}


exports.counterLabels = counterLabels;
exports.counterUnits = counterUnits;
exports.colorSwatches = colorSwatches;
exports.getColorPattern = getColorPattern;
exports.getColorPatternLines = getColorPatternLines;
exports.chartTypes = chartTypes;