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

/* exported resizeLoopChart */

// Line chart for displaying event loop latency

// Width of div allocated for this graph
var loopCanvasWidth = $('#loopDiv').width() - 8; // -8 for margin and
// border
var loopGraphWidth = loopCanvasWidth - margin.left - margin.right;

// set up the scales for x and y using the graph's dimensions
var l_xScale = d3.time.scale().range([0, loopGraphWidth]);
var l_yScale = d3.scale.linear().range([graphHeight, 0]);

// data storage
var lData = [];

// set up X axis for time in HH:MM:SS
var l_xAxis = d3.svg.axis().scale(l_xScale)
    .orient('bottom').ticks(3).tickFormat(getTimeFormat());

// set up Y axis for time in ms
var l_yAxis = d3.svg.axis().scale(l_yScale)
    .orient('left').ticks(8).tickFormat(function(d) {
      return d + 'ms';
    });

// line function for maximum latency
var l_max_line = d3.svg.line()
    .x(function(d) {
      return l_xScale(d.time);
    })
    .y(function(d) {
      return l_yScale(d.latency.max);
    });

// line function for minimum latency
var l_min_line = d3.svg.line()
    .x(function(d) {
      return l_xScale(d.time);
    })
    .y(function(d) {
      return l_yScale(d.latency.min);
    });

// line function for average latency
var l_avg_line = d3.svg.line()
    .x(function(d) {
      return l_xScale(d.time);
    })
    .y(function(d) {
      return l_yScale(d.latency.avg);
    });

var lSVG = d3.select('#loopDiv')
    .append('svg')
    .attr('width', loopCanvasWidth)
    .attr('height', canvasHeight)
    .attr('class', 'lChart');

var lTitleBox = lSVG.append('rect')
    .attr('width', loopCanvasWidth)
    .attr('height', 30)
    .attr('class', 'titlebox');

// define the chart canvas
var lChart = lSVG
    .append('g')
    .attr('transform',
      'translate(' + margin.left + ',' + margin.top + ')');

// Scale the X range to the data's time interval
l_xScale.domain(d3.extent(lData, function(d) {
  return d.time;
}));

// Scale the Y range from 0 to the largest maximum latency
l_yScale.domain([0, Math.ceil(d3.extent(lData, function(d) {
  return d.latency.max;
})[1] * 1000) / 1000]);

// Draw the max line path.
lChart.append('path')
    .attr('class', 'line1')
    .attr('d', l_max_line(lData));

// Draw the min line path.
lChart.append('path')
    .attr('class', 'line2')
    .attr('d', l_min_line(lData));

// Draw the avg line path.
lChart.append('path')
    .attr('class', 'line3')
    .attr('d', l_avg_line(lData));

// Draw the X Axis
lChart.append('g')
    .attr('class', 'xAxis')
    .attr('transform', 'translate(0,' + graphHeight + ')')
    .call(l_xAxis);

// Draw the Y Axis
lChart.append('g')
    .attr('class', 'yAxis')
    .call(l_yAxis);

// Draw the title
lChart.append('text')
    .attr('x', 7 - margin.left)
    .attr('y', 15 - margin.top)
    .attr('dominant-baseline', 'central')
    .text(localizedStrings.loopTitle);

// Add the placeholder text
var lChartPlaceholder = lChart.append('text')
    .attr('x', loopGraphWidth / 2)
    .attr('y', graphHeight / 2)
    .attr('text-anchor', 'middle')
    .text(localizedStrings.NoDataMsg);

// Add the MAXIMUM colour box
lChart.append('rect')
    .attr('x', 0)
    .attr('y', graphHeight + margin.bottom - 20)
    .attr('class', 'colourbox1')
    .attr('width', 10)
    .attr('height', 10);

// Add the MAXIMUM line label
var lMaxLabel = lChart.append('text')
    .attr('x', 15)
    .attr('y', graphHeight + margin.bottom - 10)
    .attr('text-anchor', 'start')
    .attr('class', 'lineLabel')
    .text(localizedStrings.loopMaximumMsg);

// Add the MINIMUM colour box
lChart.append('rect')
    .attr('x', lMaxLabel.node().getBBox().width + 25)
    .attr('y', graphHeight + margin.bottom - 20)
    .attr('width', 10)
    .attr('height', 10)
    .attr('class', 'colourbox2');

// Add the MINIMUM line label
var lMinLabel = lChart.append('text')
    .attr('x', lMaxLabel.node().getBBox().width + 40)
    .attr('y', graphHeight + margin.bottom - 10)
    .attr('class', 'lineLabel')
    .text(localizedStrings.loopMinimumMsg);

// Add the AVERAGE colour box
lChart.append('rect')
    .attr('x', lMaxLabel.node().getBBox().width + lMinLabel.node().getBBox().width + 50)
    .attr('y', graphHeight + margin.bottom - 20)
    .attr('width', 10)
    .attr('height', 10)
    .attr('class', 'colourbox3');

// Add the AVERAGE line label
lChart.append('text')
    .attr('x', lMaxLabel.node().getBBox().width + lMinLabel.node().getBBox().width + 65)
    .attr('y', graphHeight + margin.bottom - 10)
    .attr('class', 'lineLabel')
    .text(localizedStrings.loopAverageMsg);

// Draw the Latest MAX Data
lChart.append('text')
    .attr('x', 0)
    .attr('y', 0 - (margin.top * 3 / 8))
    .attr('class', 'maxlatest')
    .style('font-size', '32px');

// Draw the Latest MIN Data
lChart.append('text')
    .attr('x', loopGraphWidth / 3) // 1/3 across
    .attr('y', 0 - (margin.top * 3 / 8))
    .attr('class', 'minlatest')
    .style('font-size', '32px');

// Draw the Latest AVG Data
lChart.append('text')
    .attr('x', (loopGraphWidth / 3) * 2) // 2/3 across
    .attr('y', 0 - (margin.top * 3 / 8))
    .attr('class', 'avglatest')
    .style('font-size', '32px');

var lChartIsFullScreen = false;

// Add the maximise button
var lResize = lSVG.append('image')
    .attr('x', loopCanvasWidth - 30)
    .attr('y', 4)
    .attr('width', 24)
    .attr('height', 24)
    .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
    .attr('class', 'maximize')
    .on('click', function(){
      lChartIsFullScreen = !lChartIsFullScreen;
      d3.select('#dashboard').selectAll('.hideable')
        .classed('invisible', lChartIsFullScreen);
      d3.select('#loopDiv')
        .classed('fullscreen', lChartIsFullScreen)
        .classed('invisible', false); // remove invisible from this chart
      if (lChartIsFullScreen) {
        d3.select('.lChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
        // Redraw this chart only
        resizeLoopChart();
      } else {
        d3.select('.lChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
        canvasHeight = 250;
        graphHeight = canvasHeight - margin.top - margin.bottom;
        // Redraw all
        resize();
      }
    })
    .on('mouseover', function() {
      if (lChartIsFullScreen) {
        d3.select('.lChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24.png');
      } else {
        d3.select('.lChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24.png');
      }
    })
    .on('mouseout', function() {
      if (lChartIsFullScreen) {
        d3.select('.lChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
      } else {
        d3.select('.lChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
      }
    });

function resizeLoopChart() {
  if (lChartIsFullScreen) {
    canvasHeight = $('#loopDiv').height() - 100;
    graphHeight = canvasHeight - margin.top - margin.bottom;
  }
  loopCanvasWidth = $('#loopDiv').width() - 8;
  loopGraphWidth = loopCanvasWidth - margin.left - margin.right;
  // Redraw placeholder
  lChartPlaceholder
    .attr('x', loopGraphWidth / 2)
    .attr('y', graphHeight / 2);
  // Move maximise/minimise button
  lResize
    .attr('x', loopCanvasWidth - 30)
    .attr('y', 4);
  // resize the canvas
  var chart = d3.select('.lChart');
  chart
    .attr('width', loopCanvasWidth)
    .attr('height', canvasHeight);
  // resize the scale and axes
  l_xScale = d3.time.scale().range([0, loopGraphWidth]);
  l_xAxis = d3.svg.axis()
    .scale(l_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());
  l_yScale = d3.scale.linear().range([graphHeight, 0]);
  l_yAxis = d3.svg.axis().scale(l_yScale)
    .orient('left')
    .ticks(8)
    .tickFormat(function(d) {
      return d + 'ms';
    });
  lTitleBox
    .attr('width', loopCanvasWidth);
  l_xScale.domain(d3.extent(lData, function(d) {
    return d.time;
  }));
  l_yScale.domain([0, Math.ceil(d3.extent(lData, function(d) {
    return d.latency.max;
  })[1] * 1000) / 1000]);
  // update the data lines
  chart.select('.line1')
    .attr('d', l_max_line(lData));
  chart.select('.line2')
    .attr('d', l_min_line(lData));
  chart.select('.line3')
    .attr('d', l_avg_line(lData));
  // update the axes
  chart.select('.xAxis')
    .attr('transform', 'translate(0,' + graphHeight + ')')
    .call(l_xAxis);
  chart.select('.yAxis')
    .call(l_yAxis);

  // Move labels
  chart.selectAll('.lineLabel')
    .attr('y', graphHeight + margin.bottom - 10);
  chart.select('.colourbox1')
    .attr('y', graphHeight + margin.bottom - 20);
  chart.select('.colourbox2')
    .attr('y', graphHeight + margin.bottom - 20);
  chart.select('.colourbox3')
    .attr('y', graphHeight + margin.bottom - 20);
}

// eventloop: { time: , latency: { min: , max: , avg: }}
// loop: { count: ,  minimum: , maximum: , average: }
function updateLoopData(lRequest) {
  var lRequestData = JSON.parse(lRequest);  // parses the data into a JSON array
  if (!lRequestData) return;
  var d = lRequestData;
  // XXX loop data should be timestamped at source, aproximate it here for now.
  // XXX why is 'latency' measured every .5 seconds, and reported every 5
  // seconds, and loop times are only collected/reported once a minute?
  d.time = new Date();
  d.latency = {};
  d.latency.min = +d.minimum;
  d.latency.max = +d.maximum;
  d.latency.avg = +d.average;
  // round the latest data to the nearest thousandth
  lData.push(d);

  if (lData.length === 2) {
    // second data point - remove "No Data Available" label
    lChartPlaceholder.attr('visibility', 'hidden');
  }
  // Only keep 'maxTimeWindow' (defined in index.html) milliseconds of data
  var currentTime = Date.now();
  var first = lData[0];
  while (first.hasOwnProperty('time') && first.time.valueOf() + maxTimeWindow < currentTime) {
    lData.shift();
    first = lData[0];
  }
  // Re-scale the X range to the new data time interval
  l_xScale.domain(d3.extent(lData, function(d) {
    return d.time;
  }));
  // Re-scale the Y range to the new largest max latency
  l_yScale.domain([0, Math.ceil(d3.extent(lData, function(d) {
    return d.latency.max;
  })[1] * 1000) / 1000]);
  l_xAxis.tickFormat(getTimeFormat());
  var selection = d3.select('.lChart');
  // update the data lines
  selection.select('.line1')
    .attr('d', l_max_line(lData));
  selection.select('.line2')
    .attr('d', l_min_line(lData));
  selection.select('.line3')
    .attr('d', l_avg_line(lData));
  // update the axes
  selection.select('.xAxis')
    .call(l_xAxis);
  selection.select('.yAxis')
    .call(l_yAxis);
}
