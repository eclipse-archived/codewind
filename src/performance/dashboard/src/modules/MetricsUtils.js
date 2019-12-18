/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
*******************************************************************************/

/**
 * Returns the counter names for each fo the application metrics engines
 * @param {string} appMetricsName
 */
let getLanguageCounters = function (appMetricsName) {
    switch (appMetricsName) {
        case "nodejs": {
            return {
                HTTP_AVERAGE_RESPONSE: 'averageResponseTime',
                HTTP_HITS: 'hits',
                CPU_PROCESS_MEAN: 'processMean',
                MEM_PROCESS_PEAK: 'usedHeapAfterGCPeak'
            }
        }
        case "java": {
            return {
                HTTP_AVERAGE_RESPONSE: 'averageResponseTime',
                HTTP_HITS: 'hits',
                CPU_PROCESS_MEAN: 'processMean',
                MEM_PROCESS_PEAK: 'usedHeapAfterGCPeak'
            }
        }
        case "swift": {
            return {
                HTTP_AVERAGE_RESPONSE: 'averageResponseTime',
                HTTP_HITS: 'hits',
                CPU_PROCESS_MEAN: 'processMean',
                MEM_PROCESS_PEAK: 'processMean'
            }
        }
        default: {
            return {
                HTTP_AVERAGE_RESPONSE: undefined,
                HTTP_HITS: undefined,
                CPU_PROCESS_MEAN: undefined,
                MEM_PROCESS_PEAK: undefined
            }
        }
    }
}

let updateAllMetricDeltas = function (model, metricTypes, filteredUrl) {
    /*
     We'll receive a sorted list of timestamps with a payload object containing all the metrics run in that time window. 
     for each time slot (apart from the first), we need to populate in object containing deltas for each metric counter.
     */

    // loop through each of the timestamp tests
    for (let x = 1; x < model.length; x++) {
        let previousTest = model[x - 1];
        let currentTest = model[x];

        // loop through each of the metric types
        metricTypes.forEach(typeName => {
            let counterObjPrev = previousTest[typeName];
            let counterObjCurrent = currentTest[typeName];

            // get the available metric counters
            let valueNamesCurrent = Object.getOwnPropertyNames(counterObjCurrent.value.value.data);

            // http is an array of URLs,  extract just the counters for the url being filtered 
            if (typeName === 'http') {
                let urlSnapshot = counterObjCurrent.value.value.data.find(urlPath => {
                    const uri = urlPath.url.replace(/^.*\/\/[^/]+:?[0-9]?/, '');
                    return uri === filteredUrl;
                });
                valueNamesCurrent = (urlSnapshot) ? Object.getOwnPropertyNames(urlSnapshot) : [];
            }

            // for each of the counters calculate the deltas and store them
            valueNamesCurrent.forEach(testMetric => {
                let counterValuePrev = 0;
                let counterValueCurrent = 0;

                if (typeName === 'http') {
                    const urlSnapshotCurrent = counterObjCurrent.value.value.data.find(endpoint => {
                        const uri = endpoint.url.replace(/^.*\/\/[^/]+:?[0-9]?/, '');
                        return uri === filteredUrl;
                    });
                    if (urlSnapshotCurrent) {
                        counterValueCurrent = isNaN(urlSnapshotCurrent[testMetric]) ? 0 : urlSnapshotCurrent[testMetric];
                    }
                    const urlSnapshotPrev = counterObjPrev.value.value.data.find(endpoint => {
                        const uri = endpoint.url.replace(/^.*\/\/[^/]+:?[0-9]?/, '');
                        return uri === filteredUrl;
                    });
                    if (urlSnapshotPrev) {
                        counterValuePrev = isNaN(urlSnapshotPrev[testMetric]) ? 0 : urlSnapshotPrev[testMetric];
                    }
                } else {
                    counterValuePrev = counterObjPrev.value.value.data[testMetric];
                    counterValueCurrent = counterObjCurrent.value.value.data[testMetric];
                }

                // create delta containers if they are missing
                if (!counterObjPrev.value.value.delta) {
                    counterObjPrev.value.value.delta = {}
                }

                if (!counterObjCurrent.value.value.delta) {
                    counterObjCurrent.value.value.delta = {}
                }

                // store the delta for the appropriate metric
                counterObjCurrent.value.value.delta[testMetric] = counterValueCurrent - counterValuePrev;
            });
        });
    }
    return model;
};

/**
 *  _getCounterNames
 *
 *  Different languages return different counters for each of the metric types. 
 *
 *  eg.  Memory metrics in Node would be:  [ "usedHeapAfterGCPeak", "usedNativePeak" ]
 *  eg.  Memory metrics in Swift would be:  [ "systemMean", "systemPeak", "processMean", "processPeak" ]
 *
 *  Given a metric type,  this function returns the array list above.
 */
let getCounterNames = function (mcAPIData, metricType) {

    try {
        // get the first snapshot to parse 
        const snapshot = mcAPIData.metrics.find(metric => metric.type === metricType).metrics[0];

        // get the units from that snapshot
        const counters = snapshot.value.units;

        // pull out the keys
        return Object.keys(counters);

    } catch (err) {
        return [];
    }
}

/**
 * Formats the data from the Codewind metrics API into something which can
 * be plotted in a chart.  Only selected metrics (metricNames) will be returned
 * 
 * @param  mcAPIData the data loaded from the REST service
 * @param  metricType  the type of metric being parsed eg  'memory' or 'cpu' or 'http' etc
 * @param  metricNames eg :    ['systemMean', 'systemPeak', 'processMean', 'processPeak']
 * @param  scaleFactor multiplication scale
 */

let buildChartData = function (mcAPIData, filteredData, metricType, scaleFactor) {
    let counterNames = getCounterNames(mcAPIData, metricType);
    let columnData = [];
    counterNames.map(counterName => {
        const counterRow = [];
        counterRow.push(counterName);
        filteredData.map(snapshot => {
            const metricCounters = snapshot[metricType].value.value.data;
            const value = (metricCounters[counterName] * scaleFactor).toFixed();
            counterRow.push(value);
        });
        columnData.push(counterRow);
    })

    // columnData should result in an array of counter names and values :
    //  [
    // `   ["systemMean", "18", "19", "20", "18", "11", "11", "12", "30", "14", "15"],
    //     ["systemPeak", "23", "23", "23", "21", "14", "14", "15", "33", "16", "19"],
    //     ["processMean", "15", "17", "18", "6", "8", "9", "9", "10", "11", "11"],
    //     ["processPeak", "19", "19", "19", "8", "10", "10", "12", "11", "13", "14"]
    //  ]

    return {
        columns: columnData,
        selection: {
            enabled: true,
            grouped: true,
            multiple: true,
            draggable: true,
        },
    };
}


/**
 * Remove protocol, hostname and port from the URL if they exist
 */
let getPathFromURL = function (url) {
    const hostnamePattern = /^.*\/\/[^/]+:?[0-9]?/;
    const uri = url.replace(hostnamePattern, '');
    return uri;
}

/**
 * Formats the data from the Codewind metrics API into something which can 
 * be plotted in a chart
 * @param  mcAPIData the data loaded from the REST service
 * @param  scaleFactor data multiplication factor
 */
let buildChartDataHTTP = function (params) {

    const {scaleFactor, counterName, urlFilter, decimals, filteredData} = params;

    let columnData = [];
    columnData.push(counterName);

    filteredData.map(snapshot => {
        const urlList = snapshot.http.value.value.data;
        const urlRow = urlList.find(row => {
            let uri = getPathFromURL(row.url);
            uri = getEndpoint(uri);
            return uri === urlFilter
        });
        let value = urlRow[counterName]
        value = (value * scaleFactor).toFixed(decimals);
        columnData.push(value);
    });

    return {
        columns: columnData,
        selection: {
            enabled: true,
            grouped: true, // select all vertical points
            multiple: true,
            draggable: true,
        }
    };
}

/**
 * Searches for the HTTP Hits (by path) and then returns the snapshot timestamps for that URL
 *
 * @param {*} metrics the loaded metrics from redux
 * @param {string} filteredUrl the URL path
 * @return [{container,time}] an array of timestamps each containing a containerName and starttime
 */
let getHTTPHitTimestamps = function (metrics, filteredUrl) {

    let timestamps = [];
    const http = metrics.find(metric => { return metric.type === "http" });
    http.metrics.forEach(snapshot => {
        const urlList = snapshot.value.data;
        const foundUrlSamples = urlList.find(urlRow => {
            if (urlRow && urlRow.url) {
                let uri = getPathFromURL(urlRow.url);
                return getEndpoint(uri) === filteredUrl;
            } 
            return false;
        });
        if (foundUrlSamples) {
            timestamps.push({container: snapshot.container, time: snapshot.time});
        }
    });
    return timestamps;
}

/**
* Given the entire list of metrics, parse the list into a sorted byTime list
*/
let sortMetrics = function (metrics, filteredUrl) {

    // get timestamps keys from the http hits metric 
    const httpHitTimestamps = getHTTPHitTimestamps(metrics, filteredUrl);

    let x = -1;
    let model = httpHitTimestamps.map(t => {
        x = x + 1;
        return { 'id': t.container, 'time': t.time, 'plotNumber': x }
    })

    // merge all the metrics into the data model using the ID
    metrics.forEach(metricType => {
        metricType.metrics.forEach(snapshot => {
            const timestamp = model.find(element => { return element['id'] === snapshot['container'] });
            if (timestamp) {
                let metricsGroup = {};
                metricsGroup.type = metricType.type;
                metricsGroup.value = snapshot;
                timestamp[metricType.type] = metricsGroup;
            }
        })
    });

    // Make the load test description easier to access by copying it out of a metricType (CPU)
    // and into the parent loadTest.
    model.forEach(loadTest => {
        loadTest.desc = loadTest.cpu.value.desc;
    })

    model = updateAllMetricDeltas(model, ['cpu', 'memory', 'http'], filteredUrl);
    return model;
}


let getURLAverageResponseTime = function (urlArray, urlPath) {

    let result = 0;

    if (!urlArray || urlArray.length === 0) {
        return result;
    }

    let urlEntry = urlArray.find(entry => {
        let uri = getPathFromURL(entry.url);
        return getEndpoint(uri) === urlPath;
    });

    if (urlEntry) {
        result = urlEntry.averageResponseTime;
    }
    return result;
}

/**
 *
 * @param {*} path eg /myApi?a=1
 * @returns {string} /myApi
 */
let getEndpoint = function (path) {
    try {
        return path.split("?")[0];
    } catch (err) {
        return path;
    }
}

exports.getPathFromURL = getPathFromURL;
exports.getLanguageCounters = getLanguageCounters;
exports.updateAllMetricDeltas = updateAllMetricDeltas;
exports.buildChartDataHTTP = buildChartDataHTTP;
exports.buildChartData = buildChartData;
exports.sortMetrics = sortMetrics;
exports.getCounterNames = getCounterNames;
exports.getURLAverageResponseTime = getURLAverageResponseTime;
exports.getEndpoint = getEndpoint;
