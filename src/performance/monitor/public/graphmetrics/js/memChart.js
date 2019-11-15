/*******************************************************************************
 * Copyright 2017 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License'); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 ******************************************************************************/

// Line chart for showing memory data
// Process and system data displayed

// Define graph axes
var mem_xScale = d3.time.scale().range([0, graphWidth]);
var mem_yScale = d3.scale.linear().range([graphHeight, 0]);

var mem_xAxis = d3.svg.axis()
    .scale(mem_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());

var mem_yAxis = d3.svg.axis()
    .scale(mem_yScale)
    .orient('left')
    .ticks(8)
    .tickFormat(function(d) {
      return d3.format('.2s')(d * 1024 * 1024);
    });

// Memory data storage
var memData = [];

// Set input domain for both x and y scales
mem_xScale.domain(d3.extent(memData, function(d) {
  return d.date;
}));

mem_yScale.domain([0, Math.ceil(d3.extent(memData, function(d) {
  return d.system;
})[1] / 100) * 100]);


// Define the process memory line
var mem_processLine = d3.svg.line()
    .x(function(d) {
      return mem_xScale(d.date);
    })
    .y(function(d) {
      return mem_yScale(d.process);
    });

// Define the system memory line
var mem_systemLine = d3.svg.line()
    .x(function(d) {
      return mem_xScale(d.date);
    })
    .y(function(d) {
      return mem_yScale(d.system);
    });

var memProcessLineVisible = true;
var memSystemLineVisible = true;

// Define the memory SVG
var memSVG = d3.select('#memDiv1')
    .append('svg')
    .attr('width', canvasWidth)
    .attr('height', canvasHeight)
    .attr('class', 'memChart');

var memTitleBox = memSVG.append('rect')
    .attr('width', canvasWidth)
    .attr('height', 30)
    .attr('class', 'titlebox');

// Define the memory Chart
var memChart = memSVG.append('g')
    .attr('class', 'memGroup')
    .attr('transform',
      'translate(' + margin.left + ',' + margin.top + ')');

// Add the system line path.
memChart.append('path')
    .attr('class', 'systemLine')
    .attr('d', mem_systemLine(memData));

// Add the process line path.
memChart.append('path')
    .attr('class', 'processLine')
    .attr('d', mem_processLine(memData));

// Add the X Axis
memChart.append('g')
    .attr('class', 'xAxis')
    .attr('transform', 'translate(0,' + graphHeight + ')')
    .call(mem_xAxis);

// Add the Y Axis
memChart.append('g')
    .attr('class', 'yAxis')
    .call(mem_yAxis);

// Add the title
memChart.append('text')
    .attr('x', 7 - margin.left)
    .attr('y', 15 - margin.top)
    .attr('dominant-baseline', 'central')
    .text(localizedStrings.memoryTitle);

// Add the placeholder text
var memChartPlaceholder = memChart.append('text')
    .attr('x', graphWidth / 2)
    .attr('y', graphHeight / 2)
    .attr('text-anchor', 'middle')
    .text(localizedStrings.NoDataMsg);

// Add the system colour box
memChart.append('rect')
    .attr('x', 0)
    .attr('y', graphHeight + margin.bottom - 20)
    .attr('class', 'colourbox1')
    .attr('width', 10)
    .attr('height', 10);

// Add the system checkbox
memChart.append('foreignObject')
   .attr('class', 'checkboxHolder')
   .attr('x', 15)
   .attr('y', graphHeight + margin.bottom - 25)
   .attr('width', 30)
   .attr('height', 25)
   .append('xhtml:tree')
   .html('<label class=\'inline\'><input type=\'checkbox\' id=memChartSystemCheckbox checked>' +
     '<span class=\'lbl\'></span></label>')
   .on('click', function(){
     memSystemLineVisible = memSVG.select('#memChartSystemCheckbox').node().checked;
     resizeMemChart();
   });

// Add the SYSTEM label
var memSystemLabel = memChart.append('text')
    .attr('x', 35)
    .attr('y', graphHeight + margin.bottom - 10)
    .attr('text-anchor', 'start')
    .attr('class', 'lineLabel')
    .text(localizedStrings.SystemMsg);

// Add the process colour box
memChart.append('rect')
    .attr('x', memSystemLabel.node().getBBox().width + 45)
    .attr('y', graphHeight + margin.bottom - 20)
    .attr('width', 10)
    .attr('height', 10)
    .attr('class', 'colourbox2');


// Add the process checkbox
memChart.append('foreignObject')
   .attr('class', 'checkboxHolder')
   .attr('x', memSystemLabel.node().getBBox().width + 60)
   .attr('y', graphHeight + margin.bottom - 25)
   .attr('width', 30)
   .attr('height', 25)
   .append('xhtml:tree')
   .html('<label class=\'inline\'><input type=\'checkbox\' id=memChartProcessCheckbox checked>' +
     '<span class=\'lbl\'></span></label>')
   .on('click', function(){
     memProcessLineVisible = memSVG.select('#memChartProcessCheckbox').node().checked;
     resizeMemChart();
   });

// Add the PROCESS label
memChart.append('text')
    .attr('x', memSystemLabel.node().getBBox().width + 80)
    .attr('y', graphHeight + margin.bottom - 10)
    .attr('class', 'lineLabel2')
    .text(localizedStrings.ApplicationProcessMsg);

var memChartIsFullScreen = false;

// Add the maximise button
var memResize = memSVG.append('image')
    .attr('x', canvasWidth - 30)
    .attr('y', 4)
    .attr('width', 24)
    .attr('height', 24)
    .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
    .attr('class', 'maximize')
    .on('click', function(){
      memChartIsFullScreen = !memChartIsFullScreen;
      d3.select('#dashboard').selectAll('.hideable')
        .classed('invisible', memChartIsFullScreen);
      d3.select('#memDiv1')
        .classed('fullscreen', memChartIsFullScreen)
        .classed('invisible', false); // remove invisible from this chart
      if (memChartIsFullScreen) {
        d3.select('.memChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
        // Redraw this chart only
        resizeMemChart();
      } else {
        canvasWidth = $('#memDiv1').width() - 8; // -8 for margins and borders
        graphWidth = canvasWidth - margin.left - margin.right;
        d3.select('.memChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
        canvasHeight = 250;
        graphHeight = canvasHeight - margin.top - margin.bottom;
        // Redraw all
        resize();
      }
    })
    .on('mouseover', function() {
      if (memChartIsFullScreen) {
        d3.select('.memChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24.png');
      } else {
        d3.select('.memChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24.png');
      }
    })
    .on('mouseout', function() {
      if (memChartIsFullScreen) {
        d3.select('.memChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
      } else {
        d3.select('.memChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
      }
    });

function resizeMemChart() {
  if (memChartIsFullScreen) {
    canvasWidth = $('#memDiv1').width() - 8; // -8 for margins and borders
    graphWidth = canvasWidth - margin.left - margin.right;
    canvasHeight = $('#memDiv1').height() - 100;
    graphHeight = canvasHeight - margin.top - margin.bottom;
  }
  // Redraw placeholder
  memChartPlaceholder
    .attr('x', graphWidth / 2)
    .attr('y', graphHeight / 2);
  var chart = d3.select('.memChart');
  chart
    .attr('width', canvasWidth)
    .attr('height', canvasHeight);
  mem_xScale = d3.time.scale().range([0, graphWidth]);
  mem_xAxis = d3.svg.axis()
    .scale(mem_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());
  memTitleBox
    .attr('width', canvasWidth);
  memResize
    .attr('x', canvasWidth - 30)
    .attr('y', 4);
  // Redraw lines and axes
  mem_xScale.domain(d3.extent(memData, function(d) {
    return d.date;
  }));
  mem_yScale = d3.scale.linear().range([graphHeight, 0]);
  mem_yAxis = d3.svg.axis()
    .scale(mem_yScale)
    .orient('left')
    .ticks(8)
    .tickFormat(function(d) {
      return d3.format('.2s')(d * 1024 * 1024);
    });
  mem_yScale.domain([0, Math.ceil(d3.extent(memData, function(d) {
    if (memSystemLineVisible) {
      return d.system;
    } else {
      return d.process;
    }
  })[1] / 100) * 100]);
  chart.select('.systemLine')
    .attr('d', mem_systemLine(memData))
    .attr('visibility', memSystemLineVisible ? 'visible' : 'hidden');
  chart.select('.processLine')
    .attr('d', mem_processLine(memData))
    .attr('visibility', memProcessLineVisible ? 'visible' : 'hidden');
  chart.select('.xAxis')
    .attr('transform', 'translate(0,' + graphHeight + ')')
    .call(mem_xAxis);
  chart.select('.yAxis')
    .call(mem_yAxis);
  // Move labels
  chart.select('.colourbox1')
    .attr('y', graphHeight + margin.bottom - 20);
  chart.select('.lineLabel')
    .attr('y', graphHeight + margin.bottom - 10);
  chart.selectAll('.checkboxHolder')
    .attr('y', graphHeight + margin.bottom - 25);
  chart.select('.colourbox2')
    .attr('y', graphHeight + margin.bottom - 20);
  chart.select('.lineLabel2')
    .attr('y', graphHeight + margin.bottom - 10);
}

function updateMemData(memRequest) {
	// Get the data again
  var data = JSON.parse(memRequest);  // parses the data into a JSON array
  if (!data) return;
  var d = data;
  d.date = new Date(+d.time);
  d.system = +d.physical_used / (1024 * 1024);
  d.process = +d.physical / (1024 * 1024);
  memData.push(d);
  if (memData.length === 2) {
    // second data point - remove 'No Data Available' label
    memChartPlaceholder.attr('visibility', 'hidden');
  }
  // Only keep 30 minutes of data
  var currentTime = Date.now();
  var d0 = memData[0];
  if (d0 === null) return;
  while (d0.hasOwnProperty('date') && d0.date.valueOf() + maxTimeWindow < currentTime) {
    memData.shift();
    d0 = memData[0];
  }
  // Set the input domain for the axes
  mem_xScale.domain(d3.extent(memData, function(d) {
    return d.date;
  }));
  mem_yScale.domain([0, Math.ceil(d3.extent(memData, function(d) {
    if (memSystemLineVisible) {
      return d.system;
    } else {
      return d.process;
    }
  })[1] / 100) * 100]);
  mem_xAxis.tickFormat(getTimeFormat());
  // Select the section we want to apply our changes to
  var selection = d3.select('.memChart');
  // Make the changes
  selection.select('.systemLine')
    .attr('d', mem_systemLine(memData));
  selection.select('.processLine')
    .attr('d', mem_processLine(memData));
  selection.select('.xAxis')
    .call(mem_xAxis);
  selection.select('.yAxis')
    .call(mem_yAxis);
//  selection.select('.processLatest')
//    .text(memProcessLatest + 'MB');
//  selection.select('.systemLatest')
//    .text(memSystemLatest + 'MB');
}
