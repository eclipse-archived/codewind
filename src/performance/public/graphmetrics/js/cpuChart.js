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
/* exported updateCPUData */
// Line chart for displaying cpu data
// System and process data displayed


// Define graph axes
var cpu_xScale = d3.time.scale().range([0, graphWidth]);
var cpu_yScale = d3.scale.linear().range([graphHeight, 0]);

var cpu_yTicks = [0, 25, 50, 75, 100];

var cpu_xAxis = d3.svg.axis()
    .scale(cpu_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());

var cpu_yAxis = d3.svg.axis()
    .scale(cpu_yScale)
    .orient('left')
    .tickValues(cpu_yTicks)
    .tickSize(-graphWidth, 0, 0)
    .tickFormat(function(d) {
      return d + '%';
    });

// CPU Data storage
var cpuData = [];

// Define the system CPU usage line
var systemline = d3.svg.line().interpolate('basis')
    .x(function(d) {
      return cpu_xScale(d.date);
    })
    .y(function(d) {
      return cpu_yScale(d.system);
    });

// Define the process CPU usage line
var processline = d3.svg.line().interpolate('basis')
    .x(function(d) {
      return cpu_xScale(d.date);
    })
    .y(function(d) {
      return cpu_yScale(d.process);
    });

// Define the cpuChart
var cpuSVG = d3.select('#cpuDiv1')
    .append('svg')
    .attr('width', canvasWidth)
    .attr('height', canvasHeight)
    .attr('class', 'cpuChart');

var cpuTitleBox = cpuSVG.append('rect')
    .attr('width', canvasWidth)
    .attr('height', 30)
    .attr('class', 'titlebox');

var cpuChart = cpuSVG.append('g')
    .attr('class', 'cpuGroup')
    .attr('transform',
      'translate(' + margin.left + ',' + margin.top + ')');

// Set the input domain for the y axis (fixed)
cpu_yScale.domain([0, 100]);

// Add the systemline path.
cpuChart.append('path')
    .attr('class', 'systemLine')
    .attr('d', systemline(cpuData));

// Add the processline path.
cpuChart.append('path')
    .attr('class', 'processLine')
    .attr('d', processline(cpuData));

// Add the X Axis
cpuChart.append('g')
    .attr('class', 'xAxis')
    .attr('transform', 'translate(0,' + graphHeight + ')')
    .call(cpu_xAxis);

// Add the Y Axis
cpuChart.append('g')
    .attr('class', 'yAxis')
    .call(cpu_yAxis);

// Add the title
cpuChart.append('text')
    .attr('x', 7 - margin.left)
    .attr('y', 15 - margin.top)
    .attr('dominant-baseline', 'central')
    .text(localizedStrings.cpuTitle);

// Add the placeholder text
var cpuChartPlaceholder = cpuChart.append('text')
    .attr('x', graphWidth / 2)
    .attr('y', graphHeight / 2 - 2)
    .attr('text-anchor', 'middle')
    .text(localizedStrings.NoDataMsg);

// Add the system colour box
cpuChart.append('rect')
    .attr('x', 0)
    .attr('y', graphHeight + margin.bottom - 20)
    .attr('class', 'colourbox1')
    .attr('width', 10)
    .attr('height', 10);

// Add the SYSTEM label
var cpuSystemLabel = cpuChart.append('text')
    .attr('x', 15)
    .attr('y', graphHeight + margin.bottom - 10)
    .attr('text-anchor', 'start')
    .attr('class', 'lineLabel')
    .text(localizedStrings.SystemMsg);

// Add the process colour box
cpuChart.append('rect')
    .attr('x', cpuSystemLabel.node().getBBox().width + 25)
    .attr('y', graphHeight + margin.bottom - 20)
    .attr('width', 10)
    .attr('height', 10)
    .attr('class', 'colourbox2');

// Add the PROCESS label
cpuChart.append('text')
    .attr('x', cpuSystemLabel.node().getBBox().width + 40)
    .attr('y', graphHeight + margin.bottom - 10)
    .attr('class', 'lineLabel2')
    .text(localizedStrings.ApplicationProcessMsg);

var cpuChartIsFullScreen = false;

// Add the maximise button
var cpuResize = cpuSVG.append('image')
    .attr('x', canvasWidth - 30)
    .attr('y', 4)
    .attr('width', 24)
    .attr('height', 24)
    .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
    .attr('class', 'maximize')
    .on('click', function(){
      cpuChartIsFullScreen = !cpuChartIsFullScreen;
      d3.select('#dashboard').selectAll('.hideable')
        .classed('invisible', cpuChartIsFullScreen);
      d3.select('#cpuDiv1')
        .classed('fullscreen', cpuChartIsFullScreen)
        .classed('invisible', false); // remove invisible from this chart
      if (cpuChartIsFullScreen) {
        d3.select('.cpuChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
        // Redraw this chart only
        resizeCPUChart();
      } else {
        canvasWidth = $('#cpuDiv1').width() - 8; // -8 for margins and borders
        graphWidth = canvasWidth - margin.left - margin.right;
        d3.select('.cpuChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
        canvasHeight = 250;
        graphHeight = canvasHeight - margin.top - margin.bottom;
        // Redraw all
        resize();
      }
    })
    .on('mouseover', function() {
      if (cpuChartIsFullScreen) {
        d3.select('.cpuChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24.png');
      } else {
        d3.select('.cpuChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24.png');
      }
    })
    .on('mouseout', function() {
      if (cpuChartIsFullScreen) {
        d3.select('.cpuChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
      } else {
        d3.select('.cpuChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
      }
    });

function resizeCPUChart() {
  if (cpuChartIsFullScreen) {
    canvasWidth = $('#cpuDiv1').width() - 8; // -8 for margins and borders
    graphWidth = canvasWidth - margin.left - margin.right;
    canvasHeight = $('#cpuDiv1').height() - 100;
    graphHeight = canvasHeight - margin.top - margin.bottom;
  }
  // Redraw placeholder
  cpuChartPlaceholder
    .attr('x', graphWidth / 2)
    .attr('y', graphHeight / 2);

  var chart = d3.select('.cpuChart');
  chart
    .attr('width', canvasWidth)
    .attr('height', canvasHeight);
  cpu_xScale = d3.time.scale().range([0, graphWidth]);
  cpu_yScale = d3.scale.linear().range([graphHeight, 0]);
  cpu_xAxis = d3.svg.axis()
    .scale(cpu_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());
  cpu_yAxis = d3.svg.axis()
    .scale(cpu_yScale)
    .orient('left')
    .tickValues(cpu_yTicks)
    .tickSize(-graphWidth, 0, 0)
    .tickFormat(function(d) {
      return d + '%';
    });
  cpuTitleBox.attr('width', canvasWidth);
  cpuResize
    .attr('x', canvasWidth - 30)
    .attr('y', 4);

  // Redraw lines and axes
  cpu_xScale.domain(d3.extent(cpuData, function(d) {
    return d.date;
  }));
  cpu_yScale.domain([0, 100]);
  chart.select('.systemLine')
    .attr('d', systemline(cpuData));
  chart.select('.processLine')
    .attr('d', processline(cpuData));
  chart.select('.xAxis')
    .attr('transform', 'translate(0,' + graphHeight + ')')
    .call(cpu_xAxis);
  chart.select('.yAxis')
    .call(cpu_yAxis);
  chart.select('.colourbox1')
    .attr('y', graphHeight + margin.bottom - 20);
  chart.select('.lineLabel')
    .attr('y', graphHeight + margin.bottom - 10);
  chart.select('.colourbox2')
    .attr('y', graphHeight + margin.bottom - 20);
  chart.select('.lineLabel2')
    .attr('y', graphHeight + margin.bottom - 10);
}

function updateCPUData(cpuRequest) {
  var cpuRequestData = JSON.parse(cpuRequest);  // parses the data into a JSON array
  if (!cpuRequestData) return;
  var d = cpuRequestData;
  if (d != null && d.hasOwnProperty('time')) {
    d.date = new Date(+d.time);
    d.system = +d.system * 100;
    d.process = +d.process * 100;
    cpuData.push(d);
  }
  if (cpuData.length === 2) {
    // second data point - remove "No Data Available" label
    cpuChartPlaceholder.attr('visibility', 'hidden');
  }
  // Throw away expired data
  var currentTime = Date.now();
  var first = cpuData[0];
  if (first === null) return;
  while (first.hasOwnProperty('date') && first.date.valueOf() + maxTimeWindow < currentTime) {
    cpuData.shift();
    first = cpuData[0];
  }
  // Set the input domain for the x axis
  cpu_xScale.domain(d3.extent(cpuData, function(d) {
    return d.date;
  }));
  cpu_xAxis.tickFormat(getTimeFormat());
  // Select the CPU chart svg element to apply changes
  var selection = d3.select('.cpuChart');
  selection.select('.systemLine')
    .attr('d', systemline(cpuData));
  selection.select('.processLine')
    .attr('d', processline(cpuData));
  selection.select('.xAxis')
    .call(cpu_xAxis);
  selection.select('.yAxis')
    .call(cpu_yAxis);
}
