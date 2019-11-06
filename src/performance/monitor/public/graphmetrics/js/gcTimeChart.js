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

// Line chart for displaying gc data
// Collection time plotted as a percentage


// Define graph axes
var gc_xScale = d3.time.scale().range([0, graphWidth]);
var gc_yScale = d3.scale.linear().range([graphHeight, 0]);
var gc_yTicks = [0, 25, 50, 75, 100];

var gc_xAxis = d3.svg.axis()
    .scale(gc_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());

var gc_yAxis = d3.svg.axis()
    .scale(gc_yScale)
    .orient('left')
    .tickValues(gc_yTicks)
    .tickSize(-graphWidth, 0, 0)
    .tickFormat(function(d) {
      return d + '%';
    });

// gc Data storage
var gcData = [];

// Define the GC Collection Time line
var gcline = d3.svg.line().interpolate('basis')
    .x(function(d) {
      return gc_xScale(d.date);
    })
    .y(function(d) {
      return gc_yScale(d.gcTime);
    });

// Define the gcChart
var gcSVG = d3.select('#gcDiv1')
    .append('svg')
    .attr('width', canvasWidth)
    .attr('height', canvasHeight)
    .attr('class', 'gcChart');

var gcTitleBox = gcSVG.append('rect')
    .attr('width', canvasWidth)
    .attr('height', 30)
    .attr('class', 'titlebox');

var gcChart = gcSVG.append('g')
    .attr('class', 'gcGroup')
    .attr('transform',
      'translate(' + margin.left + ',' + margin.top + ')');

// Set the input domain for the y axis (fixed)
gc_yScale.domain([0, 100]);

// Add the gcline path.
gcChart.append('path')
    .attr('class', 'gcLine')
    .attr('d', gcline(gcData));

// Add the X Axis
gcChart.append('g')
    .attr('class', 'xAxis')
    .attr('transform', 'translate(0,' + graphHeight + ')')
    .call(gc_xAxis);

// Add the Y Axis
gcChart.append('g')
    .attr('class', 'yAxis')
    .call(gc_yAxis);

// Add the title
gcChart.append('text')
    .attr('x', 7 - margin.left)
    .attr('y', 15 - margin.top)
    .attr('dominant-baseline', 'central')
    .text('Garbage Collection Time');

// Add the placeholder text
var gcChartPlaceholder = gcChart.append('text')
    .attr('x', graphWidth / 2)
    .attr('y', graphHeight / 2 - 2)
    .attr('text-anchor', 'middle')
    .text('No Data Available');

var gcChartIsFullScreen = false;

// Add the maximise button
var gcResize = gcSVG.append('image')
    .attr('x', canvasWidth - 30)
    .attr('y', 4)
    .attr('width', 24)
    .attr('height', 24)
    .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
    .attr('class', 'maximize')
    .on('click', function(){
      gcChartIsFullScreen = !gcChartIsFullScreen;
      d3.select('#dashboard').selectAll('.hideable')
        .classed('invisible', gcChartIsFullScreen);
      d3.select('#gcDiv1')
        .classed('fullscreen', gcChartIsFullScreen)
        .classed('invisible', false); // remove invisible from this chart
      if (gcChartIsFullScreen) {
        d3.select('.gcChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
        // Redraw this chart only
        resizeGCChart();
      } else {
        canvasWidth = $('#gcDiv1').width() - 8; // -8 for margins and borders
        graphWidth = canvasWidth - margin.left - margin.right;
        d3.select('.gcChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
        canvasHeight = 250;
        graphHeight = canvasHeight - margin.top - margin.bottom;
        // Redraw all
        resize();
      }
    })
    .on('mouseover', function() {
      if (gcChartIsFullScreen) {
        d3.select('.gcChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24.png');
      } else {
        d3.select('.gcChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24.png');
      }
    })
    .on('mouseout', function() {
      if (gcChartIsFullScreen) {
        d3.select('.gcChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
      } else {
        d3.select('.gcChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
      }
    });

function resizeGCChart() {
  if (gcChartIsFullScreen) {
    canvasWidth = $('#gcDiv1').width() - 8; // -8 for margins and borders
    graphWidth = canvasWidth - margin.left - margin.right;
    canvasHeight = $('#gcDiv1').height() - 100;
    graphHeight = canvasHeight - margin.top - margin.bottom;
  }
  // Redraw placeholder
  gcChartPlaceholder
    .attr('x', graphWidth / 2)
    .attr('y', graphHeight / 2);
  var chart = d3.select('.gcChart');
  chart
    .attr('width', canvasWidth)
    .attr('height', canvasHeight);
  gc_xScale = d3.time.scale().range([0, graphWidth]);
  gc_yScale = d3.scale.linear().range([graphHeight, 0]);
  gc_xAxis = d3.svg.axis()
    .scale(gc_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());
  gc_yAxis = d3.svg.axis()
    .scale(gc_yScale)
    .orient('left')
    .tickValues(gc_yTicks)
    .tickSize(-graphWidth, 0, 0)
    .tickFormat(function(d) {
      return d + '%';
    });
  gcTitleBox
    .attr('width', canvasWidth);
  gcResize
    .attr('x', canvasWidth - 30)
    .attr('y', 4);

  // Redraw lines and axes
  gc_xScale.domain(d3.extent(gcData, function(d) {
    return d.date;
  }));
  gc_yScale.domain([0, 100]);
  chart.select('.gcLine')
    .attr('d', gcline(gcData));
  chart.select('.xAxis')
    .attr('transform', 'translate(0,' + graphHeight + ')')
    .call(gc_xAxis);
  chart.select('.yAxis')
    .call(gc_yAxis);
}


function updateGCData(gcRequest) {
  var gcRequestData = JSON.parse(gcRequest);  // parses the data into a JSON array
  if (!gcRequestData) return;
  var d = gcRequestData;
  if (d != null && d.hasOwnProperty('time')) {
    d.date = new Date(+d.time);
    d.gcTime = +d.gcTime * 100;
  }
  gcData.push(d);

  if (gcData.length === 2) {
    // second data point - remove "No Data Available" label
    gcChartPlaceholder.attr('visibility', 'hidden');
  }
  // Throw away expired data
  var currentTime = Date.now();
  var d0 = gcData[0];
  if (d0 === null) return;
  while (d0.hasOwnProperty('date') && d0.date.valueOf() + maxTimeWindow < currentTime) {
    gcData.shift();
    d0 = gcData[0];
  }
  // Set the input domain for the x axis
  gc_xScale.domain(d3.extent(gcData, function(d) {
    return d.date;
  }));
  gc_xAxis.tickFormat(getTimeFormat());
  // Select the gc chart svg element to apply changes
  var selection = d3.select('.gcChart');
  selection.select('.gcLine')
    .attr('d', gcline(gcData));
  selection.select('.xAxis')
    .call(gc_xAxis);
  selection.select('.yAxis')
    .call(gc_yAxis);
}
