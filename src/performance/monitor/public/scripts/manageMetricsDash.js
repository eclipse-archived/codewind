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

// CPU Summary data
let totalProcessCPULoad = 0.0;
let totalSystemCPULoad = 0.0;
let numCPULoadSamples = 0;

const summary = {
  cpu: {},
  gc: {},
  memoryPools: {},
};

let hostname = location.host.split(':')[0];
let envTable = new TextTable('#envDiv', '#summary', localizedStrings.envTitle);
let summaryTable = new TextTable('#summaryDiv', '#summary', localizedStrings.summaryTitle);
let httpSummary = new HttpSummary('#httpSummaryDiv', '#summary', localizedStrings.httpSummaryTitle);
httpSummary.setHttpSummaryOptions({ host: hostname, filteredPath: dashboardRoot });

let selected_tab = "main-tab"

window.addEventListener('resize', resize);

// Also re-size when we change tabs in case we re-sized
// while the new tab wasn't visible.
$('.nav-tabs a').on('shown.bs.tab', function (event) {
  selected_tab = event.target.id;
  resize();
});

// socket.on('probe-events', function(data) {
//   updateProbesData(data);
// });
// socket.on('title', function(data) {
//   updateHeader(data);
// });

getEnvDataAndUpdateEnvSummary();
pollMetricsAndUpdateDash(maxPolls, updateDash);

let numFlameGraphUpdates = 0;

function updateDash(projectData) {
  if (projectData.metrics) {
    const combinedMetrics = combineMetrics(projectData.metrics);
    updateGraphs(combinedMetrics);
  }
  if ((numFlameGraphUpdates < maxFlameGraphUpdates) && Array.isArray(projectData.profiling)) {
    updateFlameGraph(projectData.profiling)
    numFlameGraphUpdates++;
  }
}

function combineMetrics(metrics) {
  let metricsFromUser = [];
  let metricsFromCodewind = [];

  if (metrics.fromUser) {
    metricsFromUser = parsePrometheusTextFormat(metrics.fromUser);
  }

  if (metrics.fromCodewind) {
    metricsFromCodewind = parsePrometheusTextFormat(metrics.fromCodewind);
  }

  const metricsFromUserNotProvidedByCodewind = metricsFromUser.filter(userMetric =>
    !metricsFromCodewind.some(cwMetric => cwMetric.name === userMetric.name)
  );
  // console.log('metricsFromUserNotProvidedByCodewind');
  // console.log(metricsFromUserNotProvidedByCodewind);

  const combinedMetrics = metricsFromCodewind.concat(metricsFromUserNotProvidedByCodewind);
  // console.log('combinedMetrics');
  // console.log(combinedMetrics);
  return combinedMetrics;
}

let indexOfLastViewedSample = 0;
function updateFlameGraph(profilingSamples) {
  const newProfilingSamples = profilingSamples.slice(indexOfLastViewedSample);
  newProfilingSamples.forEach(sample => {
    processProfilingSample(sample);
  });
  indexOfLastViewedSample += newProfilingSamples.length;
}

function updateGraphs(metrics) {
  const time = Date.now();
  const cpuData = { time };
  const memData = { time };
  const aggregateDataAboutHttpRequestsReceivedInSnapshot = { time };
  const aggregateDataAboutHttpsRequestsReceivedInSnapshot = { time };
  const aggregateDataAboutHttpRequestsSentDuringSnapshot = { time };
  const aggregateDataAboutHttpsRequestsSentDuringSnapshot = { time };
  const alltimeDataAboutHttpRequests = {};
  const eventLoopData = {};
  const gcData = { time };
  for (const metric of metrics) {
    const metricsObj = metric.metrics[0];
    let metricValue;
    if (metricsObj) {
      metricValue = metricsObj.value;
    }
    if (metric.name === 'os_cpu_used_ratio') {
      cpuData.system = metricValue;
    } else if (metric.name === 'process_cpu_used_ratio') {
      cpuData.process = metricValue;

    } else if (metric.name === 'os_resident_memory_bytes') {
      memData.physical_used = metricValue;
    } else if (metric.name === 'process_resident_memory_bytes') {
      memData.physical = metricValue;
    } else if (metric.name === 'process_virtual_memory_bytes') {
      memData.virtual = metricValue;

    } else if (metric.name === 'http_requests_snapshot_total') {
      aggregateDataAboutHttpRequestsReceivedInSnapshot.total = metricsObj.value;
    } else if (metric.name === 'http_requests_duration_average_microseconds') {
      aggregateDataAboutHttpRequestsReceivedInSnapshot.average = metricsObj.value;
    } else if (metric.name === 'http_requests_duration_max_microseconds') {
      aggregateDataAboutHttpRequestsReceivedInSnapshot.url = metricsObj.labels.handler;
      aggregateDataAboutHttpRequestsReceivedInSnapshot.longest = metricsObj.value;

    } else if (metric.name === 'https_requests_total') {
      aggregateDataAboutHttpsRequestsReceivedInSnapshot.total = metricsObj.value;
    } else if (metric.name === 'https_requests_duration_average_microseconds') {
      aggregateDataAboutHttpsRequestsReceivedInSnapshot.average = metricsObj.value;
    } else if (metric.name === 'https_requests_duration_max_microseconds') {
      aggregateDataAboutHttpsRequestsReceivedInSnapshot.url = metricsObj.labels.handler;
      aggregateDataAboutHttpsRequestsReceivedInSnapshot.longest = metricsObj.value;

    } else if (metric.name === 'http_outbound_requests_total') {
      aggregateDataAboutHttpRequestsSentDuringSnapshot.total = metricsObj.value;
    } else if (metric.name === 'http_outbound_requests_duration_average_microseconds') {
      aggregateDataAboutHttpRequestsSentDuringSnapshot.average = metricsObj.value;
    } else if (metric.name === 'http_outbound_requests_duration_max_microseconds') {
      aggregateDataAboutHttpRequestsSentDuringSnapshot.url = metricsObj.labels.url;
      aggregateDataAboutHttpRequestsSentDuringSnapshot.longest = metricsObj.value;

    } else if (metric.name === 'https_outbound_requests_total') {
      aggregateDataAboutHttpsRequestsSentDuringSnapshot.total = metricsObj.value;
    } else if (metric.name === 'https_outbound_requests_duration_average_microseconds') {
      aggregateDataAboutHttpsRequestsSentDuringSnapshot.average = metricsObj.value;
    } else if (metric.name === 'https_outbound_requests_duration_max_microseconds') {
      aggregateDataAboutHttpsRequestsSentDuringSnapshot.url = metricsObj.labels.url;
      aggregateDataAboutHttpsRequestsSentDuringSnapshot.longest = metricsObj.value;

    } else if (metric.name.includes('alltime')) {
      for (const metricsObj of metric.metrics) {
        const { handler, method } = metricsObj.labels;
        const endpoint = `${method.toUpperCase()} ${handler}`;
        if (!alltimeDataAboutHttpRequests.hasOwnProperty(endpoint)) {
          alltimeDataAboutHttpRequests[endpoint] = {
            url: endpoint,
          };
        }
        const alltimeData = alltimeDataAboutHttpRequests[endpoint];
        if (metric.name === 'http_requests_alltime_total') {
          alltimeData.hits = metricsObj.value;
        } else if (metric.name === 'http_requests_alltime_duration_average_microseconds') {
          alltimeData.averageResponseTime = metricsObj.value;
        } else if (metric.name === 'http_requests_alltime_duration_max_microseconds') {
          alltimeData.longestResponseTime = metricsObj.value;
        }
      }

    } else if (metric.name === 'event_loop_tick_min_milliseconds') {
      eventLoopData.minimum = metricValue;
    } else if (metric.name === 'event_loop_tick_max_milliseconds') {
      eventLoopData.maximum = metricValue;
    } else if (metric.name === 'event_loop_tick_count') {
      eventLoopData.count = metricValue;
    } else if (metric.name === 'event_loop_tick_average_milliseconds') {
      eventLoopData.average = metricValue;
    } else if (metric.name === 'event_loop_cpu_user') {
      eventLoopData.cpu_user = metricValue;
    } else if (metric.name === 'event_loop_cpu_system') {
      eventLoopData.cpu_system = metricValue;

    } else if (metric.name === 'heap_size_bytes') {
      gcData.size = metricValue;
    } else if (metric.name === 'heap_memory_used_bytes') {
      gcData.used = metricValue;
    } else if (metric.name === 'heap_memory_used_max_bytes') {
      gcData.maxHeapUsed = metricValue;
    } else if (metric.name === 'gc_cycle_duration_milliseconds') {
      gcData.duration = metricValue;
    } else if (metric.name === 'gc_cycle_duration_total_milliseconds') {
      gcData.durationTotal = metricValue;
    } else if (metric.name === 'process_uptime_count_seconds') {
      gcData.processUptime = metricValue;
    }
  }

  if (Object.keys(cpuData).length > 1) {
    processCPUData(
      cpuData,
      totalProcessCPULoad,
      totalSystemCPULoad,
      numCPULoadSamples,
    );
  }
  if (Object.keys(memData).length > 1) {
    updateMemData(JSON.stringify(memData));
  }
  if (Object.keys(aggregateDataAboutHttpRequestsReceivedInSnapshot).length > 1) {
    updateHttpData(JSON.stringify(aggregateDataAboutHttpRequestsReceivedInSnapshot));
  }
  if (Object.keys(aggregateDataAboutHttpsRequestsReceivedInSnapshot).length > 1) {
    updateHttpsData(JSON.stringify(aggregateDataAboutHttpsRequestsReceivedInSnapshot));
  }
  if (Object.keys(aggregateDataAboutHttpRequestsSentDuringSnapshot).length > 1) {
    updateHttpOBData(JSON.stringify(aggregateDataAboutHttpRequestsSentDuringSnapshot));
  }
  if (Object.keys(aggregateDataAboutHttpsRequestsSentDuringSnapshot).length > 1) {
    updateHttpsOBData(JSON.stringify(aggregateDataAboutHttpsRequestsSentDuringSnapshot));
  }
  httpSummary.updateURLData(JSON.stringify(Object.values(alltimeDataAboutHttpRequests)));

  if (Object.keys(eventLoopData).length > 1) {
    updateLoopData(JSON.stringify(eventLoopData));
  }
  if (Object.keys(gcData).length > 1) {
    processGCData(gcData);
  }

  updateSummaryTable();
}

function resize() {
  if (selected_tab == "main-tab") {
    canvasWidth = $("#cpuDiv1").width() - 8,
      httpCanvasWidth = $("#httpDiv1").width() - 8,
      graphWidth = canvasWidth - margin.left - margin.right,
      httpGraphWidth = httpCanvasWidth - margin.left - margin.right;
    resizeCPUChart();
    resizeHttpChart();
    resizeHttpOBChart();
    resizeGCChart();
    resizeLoopChart();
    resizeHttpThroughputChart();
    resizeMemChart();
    resizeProbesChart();
  } else if (selected_tab == "summary-tab") {
    envTable.resizeTable();
    summaryTable.resizeTable();
    httpSummary.resizeTable();
  } else {
    refreshFlameGraph();
  }
}

function processCPUData(data, totalProcessCPULoad, totalSystemCPULoad, numCPULoadSamples) {
  updateCPUData(JSON.stringify(data));

  totalProcessCPULoad += data.process;
  totalSystemCPULoad += data.system;
  numCPULoadSamples++;
  const processMean = (totalProcessCPULoad / numCPULoadSamples);
  const systemMean = (totalSystemCPULoad / numCPULoadSamples);

  summary.cpu.processMean = processMean;
  summary.cpu.systemMean = systemMean;
}

function processGCData(data) {
  updateGCData(JSON.stringify(data));
  summary.gc.usedHeapAfterGCMax = data.maxHeapUsed;
  summary.gc.time = ((data.durationTotal / 1000) / data.processUptime);
}

function updateSummaryTable() {
  let summaryData = [];
  if (summary.cpu.processMean) {
    let value = new Number(summary.cpu.processMean);
    let valueStr = value.toLocaleString([], { style: 'percent', minimumSignificantDigits: 4, maximumSignificantDigits: 4 });
    summaryData.push({ Parameter: 'Average Process CPU', Value: valueStr });
  }
  if (summary.cpu.systemMean) {
    let value = new Number(summary.cpu.systemMean);
    let valueStr = value.toLocaleString([], { style: 'percent', minimumSignificantDigits: 4, maximumSignificantDigits: 4 });
    summaryData.push({ Parameter: 'Average System CPU', Value: valueStr });
  }
  if (summary.gc.time) {
    let value = new Number(summary.gc.time);
    let valueStr = value.toLocaleString([], { style: 'percent', minimumSignificantDigits: 4, maximumSignificantDigits: 4 });
    summaryData.push({ Parameter: 'Time Spent in GC', Value: `${valueStr}` });
  }
  if (summary.gc.usedHeapAfterGCMax) {
    summaryData.push({ Parameter: 'Max Heap Used After GC', Value: `${summary.gc.usedHeapAfterGCMax} bytes` });
  }
  summaryTable.populateTable(summaryData);
}
