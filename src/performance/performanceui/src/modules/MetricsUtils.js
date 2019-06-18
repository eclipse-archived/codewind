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

let updateAllMetricDeltas = function (model, metricTypes, filteredUrl) {
    /*
     We'll receive a sorted list of timestamps with a payload object containing all the metrics run in that time window. 
     for each time slot (apart from the first), we need to populate in object containing deltas for each metric counter.
     */

    // loop through each of the timestamp tests
    for (let x = 1; x < model.length; x++) {
        let prevousTest = model[x - 1];
        let currentTest = model[x];

        // loop through each of the metric types
        metricTypes.forEach(typeName => {
            let counterObjPrev = prevousTest[typeName];
            let counterObjCurrent = currentTest[typeName];

            // get the available metric counters
            let valueNamesCurrent = Object.getOwnPropertyNames(counterObjCurrent.value.value.data);

            // http is an array of URLs,  extract just the counters for the url being filtered 
            if (typeName === 'http') {
                let urlSnapshot = counterObjCurrent.value.value.data.find(urlPath => {
                    const uri = urlPath.url.replace( /^.*\/\/[^/]+:?[0-9]?/, '');
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
                        const uri = endpoint.url.replace( /^.*\/\/[^/]+:?[0-9]?/, '');
                        return uri === filteredUrl;
                    });
                    if (urlSnapshotCurrent) {
                        counterValueCurrent = isNaN(urlSnapshotCurrent[testMetric]) ? 0 : urlSnapshotCurrent[testMetric];
                    }
                    const urlSnapshotPrev = counterObjPrev.value.value.data.find(endpoint => {
                        const uri = endpoint.url.replace( /^.*\/\/[^/]+:?[0-9]?/, '');
                        return uri === filteredUrl;
                    });
                    if (urlSnapshotPrev) {
                        counterValuePrev = isNaN(urlSnapshotPrev[testMetric]) ? 0 : urlSnapshotPrev[testMetric];
                    }
                } else {
                    counterValuePrev = counterObjPrev.value.value.data[testMetric];
                    counterValueCurrent =counterObjCurrent.value.value.data[testMetric];
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
 * Formats the data from the Microclimate metrics API into something which can 
 * be plotted in a chart.  Only selected metrics (metricNames) will be returned
 * @param  mcAPIData the data loaded from the REST service
 * @param  metricType  the type of metric being parsed eg  'memory' or 'cpu' or 'http' etc
 * @param  metricNames eg :    ['systemMean', 'systemPeak', 'processMean', 'processPeak']
 * @param  scaleFactor multiplication scale
 */

let buildChartData = function (mcAPIData, metricType, scaleFactor, chartStyle) {

    let counterNames = getCounterNames(mcAPIData, metricType);

    let loadedData = mcAPIData.metrics;
    let columnData = [];
    let testMetricsTypes = {};

    if (loadedData.length > 0) {
        // find the required section in the loaded data (because the API returns all the metric types in one go) 
        const metrics = loadedData.find(a => a.type === metricType);

        // extract the counters
        let counters = metrics['metrics'];

        columnData = counterNames.map(metricName => {
            let metricsData = (counters.map(test => test.value.data[metricName]));

            // scale the data
            metricsData = metricsData.map(x => { return (x * scaleFactor).toFixed(); });
            metricsData.unshift(metricName);

            return metricsData;
        });
        // Set chart rendering
        counterNames.forEach(name => {
            testMetricsTypes[name] = chartStyle;
        });
    }

    let chartData = {
        columns: columnData,
        types: testMetricsTypes,
        selection: {
            enabled: true,
            grouped: true, // select all vertical points
            multiple: true,
            draggable: true,
        },

    };

    return chartData;
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
 * Formats the data from the Microclimate metrics API into something which can 
 * be plotted in a chart
 * @param  mcAPIData the data loaded from the REST service
 * @param  scaleFactor data multiplication factor
 */
let buildChartDataHTTP = function (params) {

    const mcAPIData = params.projectMetrics;
    const scaleFactor = params.scaleFactor;
    const counterName = params.counterName;
    const chartType = params.chartType;
    const urlFilter = params.urlFilter;

    let columnData = [];
    let metricTypes = {};
    let loadedData = mcAPIData.metrics;

    if (loadedData.length > 0) {

        // find the required section in the loaded data (because the API returns all the metric types in one go) 
        const metrics = loadedData.find(section => section.type === 'http');

        // extract the counters
        let counters = metrics['metrics'];

        // get the recorded urls 
        let availableURLs = counters.map(snapshot => {
            return snapshot.value.data.map(result => {
               return getPathFromURL(result.url);
            })
        });
        if (!availableURLs) { availableURLs = []; }

        // get just the URL endpoints in a flat array
        let flattenedArrayOfURLs = availableURLs.reduce((accululatedList, currentValue) => {
            return accululatedList.concat(currentValue);
        }, []
        );

        flattenedArrayOfURLs = flattenedArrayOfURLs.filter(url => (url === urlFilter));
        
        if (!flattenedArrayOfURLs) {
            flattenedArrayOfURLs = [];
        }

        // an array of unique url endpoints
        let uniqueURLs = flattenedArrayOfURLs.filter((val, idx, arr) => arr.indexOf(val) === idx);
        columnData = uniqueURLs.map(urlPath => {
            let metricsData = (counters.map(test => {
                // check that the URL path was hit in this snapshot and includes the requested metrics
                // if it does not,  just return the counter value as ZERO 
                let urlTests = test.value.data.find(x => {
                    return getPathFromURL(x.url) === urlPath
                });
                return (urlTests) ? urlTests[counterName] : 0;
            }
            ));

            // scale the data
            metricsData = metricsData.map(x => { return (x * scaleFactor).toFixed(2); });
            metricsData.unshift(urlPath);
            return metricsData;
        });

        uniqueURLs.forEach(urlPath => {
            metricTypes[urlPath] = chartType;
        });
    }

    let chartData = {
        columns: columnData,
        types: metricTypes,
        selection: {
            enabled: true,
            grouped: true, // select all vertical points
            multiple: true,
            draggable: true,
        }
    };

    return chartData;
}

/**
* Given the entire list of metrics, parse the list into a sorted byTime list
*/
let sortMetrics = function (metrics, filteredUrl) {

    // let metrics = this.props.statsMicroclimate.statsMicroclimate;
    let timestamps = [];

    // read all the timestamps
    metrics.forEach(metricType => {
        timestamps = timestamps.concat(metricType.metrics.map(snapshot => {
            return snapshot["time"]
        }));
    });

    // remove any time duplicates
    let distinctTimestamps = timestamps.filter((value, index, self) => {
        return self.indexOf(value) === index;
    })

    // sort the timestamps in ascending order
    distinctTimestamps.sort();

    // morph and wrap timestamps, give each entry an ID and a plotNumber
    let x = -1;
    let model = distinctTimestamps.map(t => {
        x = x + 1;
        return { 'id': t.toString(), 'time': t, 'plotNumber': x }
    })

    // merge all the metrics into the data model

    metrics.forEach(metricType => {
        metricType.metrics.forEach(snapshot => {
            let timestamp = model.find(element => { return element['time'] === snapshot['time'] })
            let metricsGroup = {}
            metricsGroup.type = metricType.type;
            metricsGroup.value = snapshot;
            timestamp[metricType.type] = metricsGroup;
        })
    });

    // Make the load test description easier to access by copying it out of a metricType (CPU) and into the parent loadTest. 
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
    
    let urlEntry = urlArray.find(entry => { return getPathFromURL(entry.url) === urlPath})

    if (urlEntry) {
        result = urlEntry.averageResponseTime;
    }
    return result;
}

/**
 * 
 * @param {*} path eg /myapi?a=1
 * @returns {string} /myapi
 */
let getEndpoint = function (path) {
    try {
        return path.split("?")[0];
    } catch (err) {
        return path;
    }
}

exports.getPathFromURL = getPathFromURL;
exports.updateAllMetricDeltas = updateAllMetricDeltas;
exports.buildChartDataHTTP = buildChartDataHTTP;
exports.buildChartData = buildChartData;
exports.sortMetrics = sortMetrics;
exports.getCounterNames = getCounterNames;
exports.getURLAverageResponseTime = getURLAverageResponseTime;
exports.getEndpoint = getEndpoint;
