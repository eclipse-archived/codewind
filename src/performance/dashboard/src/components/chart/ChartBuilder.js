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

import ChartUtils from './ChartUtils';
import MetricsUtils from '../../modules/MetricsUtils';

export function buildChartRow(metricsRow, counterName) {
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

export function addCPULine(counterKeys, data, chartData) {
    if (chartData.CPU.columns && chartData.CPU.columns.length > 0) {
        const metricsRow = chartData.CPU.columns.find(metric => {
            return metric[0] === counterKeys["CPU_PROCESS_MEAN"];
        });
        if (metricsRow) {
            const metricsRowClone = metricsRow.slice();
            data.columns.push(buildChartRow(metricsRowClone, "CPU_PROCESS_MEAN"));
            metricsRowClone[0] = "CPU_PROCESS_MEAN";
            data.classes.push(metricsRowClone);
        }
    }
}

export function addMemoryLine(counterKeys, data, chartData) {
    if (chartData.MEMORY.columns && chartData.MEMORY.columns.length > 0) {
        const metricsRow = chartData.MEMORY.columns.find(metric => {
            return metric[0] === counterKeys["MEM_PROCESS_PEAK"];
        });
        if (metricsRow) {
            const metricsRowClone = metricsRow.slice();
            data.columns.push(buildChartRow(metricsRowClone, "MEM_PROCESS_PEAK"));
            metricsRowClone[0] = "MEM_PROCESS_PEAK";
            data.classes.push(metricsRowClone);
        }
    }
}

export function addHTTPLine(lineName, rowName, data, chartData) {
    if (chartData.HTTP.columns && chartData[lineName].columns.length > 0) {
        const metricsRow = chartData[lineName].columns;
        if (metricsRow) {
            const metricsRowClone = metricsRow.slice();
            data.columns.push(buildChartRow(metricsRowClone, rowName));
            metricsRowClone[0] = rowName;
            data.classes.push(metricsRowClone);
        }
    }
}

/**
 * Build the chart data model containing each of the counters 
 * @param {*} chartData 
 * @param {*} projectLanguage 
 * @param {*} absolutePath 
 */
export function buildChartData(chartData, projectLanguage, absolutePath) {

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

    const counterKeys = MetricsUtils.getLanguageCounters(projectLanguage);
    addHTTPLine('HTTPHits', "HTTP_HITS", data, chartData);
    addHTTPLine('HTTP', "HTTP_RESPONSE", data, chartData);
    addCPULine(counterKeys, data, chartData, absolutePath);
    addMemoryLine(counterKeys, data, chartData, absolutePath);
    return data;
}

/**
 * getLineData - gets a plot line for the specififed counter
 * 
 * @param chartData chart data model
 * @param counterName counter being
 * @param projectLanguage nodejs | java | swift
 * @param absolutePath application path filter 
 * @returns a plot line for the specified counter
 */
export function getLineData(chartData, counterName, projectLanguage, absolutePath) {

    const counterKeys = MetricsUtils.getLanguageCounters(projectLanguage);

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
                const metricsRow = chartData.HTTP.columns;
                return metricsRow;
            }
            return [];
        case 'HTTP_HITS':
            if (chartData.HTTPHits.columns && chartData.HTTPHits.columns.length > 0) {
                const metricsRow = chartData.HTTPHits.columns;
                return metricsRow;
            }
            return [];
        default:
            return [];
    }
}