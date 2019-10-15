/*******************************************************************************
 * Copyright 2017 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 ******************************************************************************/

/* exported resizeProbesChart */
// Line chart for displaying events emitted by probes
// set up the scales for x and y using the graph's dimensions
var probes_xScale = d3.time.scale().range([0, httpGraphWidth]);
var probes_yScale = d3.scale.linear().range([graphHeight, 0]);

// all the data
var probesData = [];
// names of probes
var probeNames = [];
// data split by probe name
var probeDataSeparated = [[]];
var colourPalette = ['#a36df5', '#734098', '#5aaafa', '#ff7832', '#8cd211', '#efc100', '#ff5050', '#6eedd8'];
var lineLabels = [];

// Single line function
var lineFunction = d3.svg.line()
    .x(function(d) {
      return probes_xScale(d.time);
    })
    .y(function(d) {
      return probes_yScale(d.duration);
    });

// set up X axis for time in HH:MM:SS
var probes_xAxis = d3.svg.axis()
    .scale(probes_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(d3.time.format('%H:%M:%S'));

// set up Y axis for time in ms
var probes_yAxis = d3.svg.axis()
    .scale(probes_yScale)
    .orient('left')
    .ticks(8)
    .tickFormat(function(d) {
      return d + 'ms';
    });

var probesSVG = d3.select('#probeEventsDiv')
    .append('svg')
    .attr('width', httpCanvasWidth)
    .attr('height', canvasHeight)
    .attr('class', 'probesChart');

var probesTitleBox = probesSVG.append('rect')
    .attr('width', httpCanvasWidth)
    .attr('height', 30)
    .attr('class', 'titlebox');

// define the chart canvas
var probesChart = probesSVG.append('g')
    .attr('transform',
      'translate(' + margin.left + ',' + margin.top + ')');

// Draw the X Axis
probesChart.append('g')
    .attr('class', 'xAxis')
    .attr('transform', 'translate(0,' + graphHeight + ')')
    .call(probes_xAxis);

// Draw the Y Axis
probesChart.append('g')
    .attr('class', 'yAxis')
    .call(probes_yAxis);

// Draw the title
probesChart.append('text')
    .attr('x', 7 - margin.left)
    .attr('y', 15 - margin.top)
    .attr('dominant-baseline', 'central')
    .text(localizedStrings.probeEventsTitle);

// Add the placeholder text
var probesChartPlaceholder = probesChart.append('text')
    .attr('x', httpGraphWidth / 2)
    .attr('y', graphHeight / 2)
    .attr('text-anchor', 'middle')
    .text(localizedStrings.NoDataMsg);

var probesChartIsFullScreen = false;

// Add the se/minimise button
var probesResize = probesSVG.append('image')
    .attr('x', httpCanvasWidth - 30)
    .attr('y', 4)
    .attr('width', 24)
    .attr('height', 24)
    .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
    .attr('class', 'maximize')
    .on('click', function(){
      probesChartIsFullScreen = !probesChartIsFullScreen;
      d3.select('#dashboard').selectAll('.hideable')
        .classed('invisible', probesChartIsFullScreen);
      d3.select('#probeEventsDiv')
        .classed('fullscreen', probesChartIsFullScreen)
        .classed('invisible', false); // remove invisible from this chart
      if (probesChartIsFullScreen) {
        d3.select('.probesChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
        // Redraw this chart only
        resizeProbesChart();
      } else {
        httpCanvasWidth = $('#probeEventsDiv').width() - 8; // -8 for margins and borders
        httpGraphWidth = httpCanvasWidth - margin.left - margin.right;
        d3.select('.probesChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
        canvasHeight = 250;
        graphHeight = canvasHeight - margin.top - margin.bottom;
        // Redraw all
        resize();
      }
    })
    .on('mouseover', function() {
      if (probesChartIsFullScreen) {
        d3.select('.probesChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24.png');
      } else {
        d3.select('.probesChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24.png');
      }
    })
    .on('mouseout', function() {
      if (probesChartIsFullScreen) {
        d3.select('.probesChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
      } else {
        d3.select('.probesChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
      }
    });

function resizeProbesChart() {
  if (probesChartIsFullScreen) {
    httpCanvasWidth = $('#probeEventsDiv').width() - 8;
    httpGraphWidth = httpCanvasWidth - margin.left - margin.right;
    canvasHeight = $('#probeEventsDiv').height() - 100;
    graphHeight = canvasHeight - margin.top - margin.bottom;
  }
  // Redraw placeholder
  probesChartPlaceholder
    .attr('x', httpGraphWidth / 2)
    .attr('y', tallerGraphHeight / 2);
  probesResize
    .attr('x', httpCanvasWidth - 30)
    .attr('y', 4);
  // resize the canvas
  var chart = d3.select('.probesChart');
  chart
    .attr('width', httpCanvasWidth)
    .attr('height', canvasHeight);
  // resize the scale and axes
  probes_xScale = d3.time.scale().range([0, httpGraphWidth]);
  probes_xAxis = d3.svg.axis()
    .scale(probes_xScale)
    .orient('bottom')
    .ticks(3);
  probes_yScale = d3.scale.linear().range([graphHeight, 0]);
  probes_yAxis = d3.svg.axis().scale(probes_yScale)
    .orient('left')
    .ticks(8)
    .tickFormat(function(d) {
      return d + 'ms';
    });
  probesTitleBox
    .attr('width', httpCanvasWidth);
  // Update the input domain
  probes_xScale.domain(d3.extent(probesData, function(d) {
    return d.time;
  }));
  probes_yScale.domain([0, d3.max(probesData, function(d) {
    return d.duration;
  })]);
  var selection = d3.select('.probesChart');
  selection.selectAll('circle').remove();
  // update the data lines
  for (var i = 0; i < probeNames.length; i++) {
    var lineName = '.line' + (i + 1);
    selection.select(lineName)
      .attr('d', lineFunction(probeDataSeparated[i]));
    // Add the points
    selection.selectAll('point' + (i + 1))
      .data(probeDataSeparated[i])
      .enter().append('circle')
      .attr('r', 4)
      .style('fill', colourPalette[i])
      // .style('stroke', 'white')
      .attr('transform',
        'translate(' + margin.left + ',' + margin.top + ')')
      .attr('cx', function(d) { return probes_xScale(d.time); })
      .attr('cy', function(d) { return probes_yScale(d.duration); });
      // .append('svg:title').text(function(d) { return d.url; }); // tooltip
  }
  // update the axes
  chart.select('.xAxis')
    .attr('transform', 'translate(0,' + graphHeight + ')')
    .call(probes_xAxis);
  chart.select('.yAxis')
    .call(probes_yAxis);
  // move the labels
  chart.selectAll('.colourbox1')
    .attr('y', graphHeight + margin.bottom - 20);
  chart.selectAll('.lineLabel1')
    .attr('y', graphHeight + margin.bottom - 10);
}

function updateProbesData(probeEvents) {
  var pData = JSON.parse(probeEvents);  // parses the data into a JSON array
  if (!pData || pData.length === 0) return;
  if (probesData.length === 0) {
    // first data - remove "No Data Available" label
    probesChartPlaceholder.attr('visibility', 'hidden');
  }
  // if(data.length >= maxDataPoints) {
     // empty arrays
  //    probesData = [];
  //    for (var i= 0; i< probeDataSeparated.length; i++) {
  //        probeDataSeparated[i] = [];
  //    }
  // }
  for (var i = 0; i < pData.length; i++) {
    var d = pData[i];
    probesData.push(d);
    var found = false;
    for (var j = 0; j < probeNames.length; j++) {
      if (probeNames[j] === d.name) {
        found = true;
        probeDataSeparated[j].push(d);
      }
    }
    if (!found) { // new type of probe event
      probeNames.push(d.name);
      probeDataSeparated[probeNames.length - 1] = [d];
      // add a new line
      probesChart.append('path')
        .attr('class', 'line' + probeNames.length)
        .style('stroke', colourPalette[probeNames.length - 1])
        .style('stroke-width', '2px')
        .style('fill', 'none');
      // Add the colour box
      probesChart.append('rect')
        .attr('x', (probeNames.length - 1) * 100)
        .attr('y', graphHeight + margin.bottom - 20)
        .attr('width', 10)
        .attr('height', 10)
        .attr('class', 'colourbox1')
        .style('fill', colourPalette[probeNames.length - 1]);
      // Add the labels
      lineLabels[probeNames.length - 1] = probesChart.append('text')
        .attr('x', 15 + (probeNames.length - 1) * 100)
        .attr('y', graphHeight + margin.bottom - 10)
        .attr('text-anchor', 'start')
        .attr('class', 'lineLabel1')
        .text(d.name);
    }
  }
  // Only keep 'maxTimeWindow' milliseconds of data
  var currentTime = Date.now();
  var cutoffTime = currentTime - maxTimeWindow;
  var d0 = probesData[0];
  while (d0.hasOwnProperty('time') && d0.time < cutoffTime) {
    probesData.shift();
    d0 = probesData[0];
  }
  //  while (probesData.length > maxDataPoints) {
  //      var d1 = probesData[0]
  //      if(d1.hasOwnProperty('time'))
  //         cutoffTime = d1.time
  //     probesData.shift()
  //  }
  for (i = 0; i < probeDataSeparated.length; i++) {
    var oneProbesData = probeDataSeparated[i];
    var d1 = oneProbesData[0];
    while (d1.hasOwnProperty('time') && d1.time <= cutoffTime) {
      oneProbesData.shift();
      d1 = oneProbesData[0];
    }
  }
  // Set the input domain for both axes
  probes_xScale.domain(d3.extent(probesData, function(d) {
    return d.time;
  }));
  probes_yScale.domain([0, Math.ceil(d3.extent(probesData, function(d) {
    return d.duration;
  })[1])]);
  var selection = d3.select('.probesChart');
  selection.selectAll('circle').remove();
  // update the data lines
  for (i = 0; i < probeNames.length; i++) {
    var lineName = '.line' + (i + 1);
    selection.select(lineName)
      .attr('d', lineFunction(probeDataSeparated[i]));
    // Add the points
    selection.selectAll('point' + (i + 1))
      .data(probeDataSeparated[i])
      .enter().append('circle')
      .attr('r', 4)
      .style('fill', colourPalette[i])
      // .style('stroke', 'white')
      .attr('transform',
        'translate(' + margin.left + ',' + margin.top + ')')
      .attr('cx', function(d) { return probes_xScale(d.time); })
      .attr('cy', function(d) { return probes_yScale(d.duration); })
      .append('svg:title')
      .text(function(d) { return d.total + ' events'; }); // tooltip
  }
  // update the axes
  selection.select('.xAxis')
    .call(probes_xAxis);
  selection.select('.yAxis')
    .call(probes_yAxis);
}
