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

/* exported resizeHttpOBChart */

// Line chart for displaying http outbound requests with time and duration

var httpOB_xScale = d3.time.scale().range([0, httpGraphWidth]);
var httpOB_yScale = d3.scale.linear().range([tallerGraphHeight, 0]);
var httpOBData = [];

var httpOB_xAxis = d3.svg.axis()
    .scale(httpOB_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());

var httpOB_yAxis = d3.svg.axis()
    .scale(httpOB_yScale)
    .orient('left')
    .ticks(5)
    .tickFormat(function(d) {
      return d + 'ms';
    });

var mouseOverHttpOBGraph = false;

// Define the HTTP request time line
var httpOBline = d3.svg.line()
    .x(function(d) {
      return httpOB_xScale(d.time);
    })
    .y(function(d) {
      return httpOB_yScale(d.longest);
    });

var httpOBSVG = d3.select('#httpOBDiv')
    .append('svg')
    .attr('width', httpCanvasWidth)
    .attr('height', canvasHeight)
    .attr('class', 'httpOBChart')
    .on('mouseover', function() {
      mouseOverHttpOBGraph = true;
    })
    .on('mouseout', function() {
      mouseOverHttpOBGraph = false;
    });

var httpOBTitleBox = httpOBSVG.append('rect')
    .attr('width', httpCanvasWidth)
    .attr('height', 30)
    .attr('class', 'titlebox');

var httpOBChart = httpOBSVG
    .append('g')
    .attr('transform',
      'translate(' + margin.left + ',' + margin.top + ')');

// Create the line
httpOBChart.append('path')
    .attr('class', 'httpline')
    .attr('d', httpOBline(httpOBData));

// Define the axes
httpOBChart.append('g')
    .attr('class', 'xAxis')
    .attr('transform', 'translate(0,' + tallerGraphHeight + ')')
    .call(httpOB_xAxis);

httpOBChart.append('g')
    .attr('class', 'yAxis')
    .call(httpOB_yAxis);

// Add the title
httpOBChart.append('text')
    .attr('x', 7 - margin.left)
    .attr('y', 15 - margin.top)
    .attr('dominant-baseline', 'central')
    .text(localizedStrings.httpOutboundTitle);

// Add the placeholder text
var httpOBChartPlaceholder = httpOBChart.append('text')
    .attr('x', httpGraphWidth / 2)
    .attr('y', tallerGraphHeight / 2)
    .attr('text-anchor', 'middle')
    .text(localizedStrings.NoDataMsg);

function updateHttpOBData(httpOutboundRequest) {
  var httpOutboundRequestData = JSON.parse(httpOutboundRequest);  // parses the data into a JSON array
  if (!httpOutboundRequestData || httpOutboundRequestData.length == 0) return;
  if (httpOBData.length === 0) {
    // first data - remove "No Data Available" label
    httpOBChartPlaceholder.attr('visibility', 'hidden');
  }
  // for (var i = 0, len = httpOutboundRequestData.length; i < len; i++) {
  //    var d = httpOutboundRequestData[i];
  //    if (d != null && d.hasOwnProperty('time')) {
  //        httpOBData.push(d)
  //    }
  // }
  httpOBData.push(httpOutboundRequestData);

  // Only keep 'maxTimeWindow' (defined in index.html) milliseconds of data
  var currentTime = Date.now();
  var d0 = httpOBData[0];
  while (d0.hasOwnProperty('time') && d0.time + maxTimeWindow < currentTime) {
    httpOBData.shift();
    d0 = httpOBData[0];
  }

  // Don't update if mouse over graph
  if (!mouseOverHttpOBGraph) {
    // Set the input domain for x and y axes
    httpOB_xScale.domain(d3.extent(httpOBData, function(d) {
      return d.time;
    }));
    httpOB_yScale.domain([0, d3.max(httpOBData, function(d) {
      return d.longest;
    })]);
    httpOB_xAxis.tickFormat(getTimeFormat());

    var selection = d3.select('.httpOBChart');
    selection.selectAll('circle').remove();
    selection.select('.httpline')
      .attr('d', httpOBline(httpOBData));
    selection.select('.xAxis')
      .call(httpOB_xAxis);
    selection.select('.yAxis')
      .call(httpOB_yAxis);
    // Add the points
    selection.selectAll('point')
      .data(httpOBData)
      .enter().append('circle')
      .attr('r', 4)
      .style('fill', '#5aaafa')
      .style('stroke', 'white')
      .attr('transform',
        'translate(' + margin.left + ',' + margin.top + ')')
      .attr('cx', function(d) { return httpOB_xScale(d.time); })
      .attr('cy', function(d) { return httpOB_yScale(d.longest); })
      .append('svg:title')
        .text(function(d) { // tooltip
          if (d.total === 1) {
            return d.url;
          } else {
            return d.total
            + ' requests\n average duration = '
            + d3.format('.2s')(d.average)
            + 'ms\n longest duration = '
            + d3.format('.2s')(d.longest)
            + 'ms for URL: ' + d.url;
          }
        });

  }
}

var httpOBChartIsFullScreen = false;
// Add the maximise/minimise button
var httpOBResize = httpOBSVG.append('image')
    .attr('x', httpCanvasWidth - 30)
    .attr('y', 4)
    .attr('width', 24)
    .attr('height', 24)
    .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
    .attr('class', 'maximize')
    .on('click', function(){
      httpOBChartIsFullScreen = !httpOBChartIsFullScreen;
      d3.select('#dashboard').selectAll('.hideable')
        .classed('invisible', httpOBChartIsFullScreen);
      d3.select('#httpOBDiv')
        .classed('fullscreen', httpOBChartIsFullScreen)
        .classed('invisible', false); // remove invisible from this chart
      if (httpOBChartIsFullScreen) {
        d3.select('.httpOBChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
        // Redraw this chart only
        resizeHttpOBChart();
      } else {
        d3.select('.httpOBChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
        canvasHeight = 250;
        tallerGraphHeight = canvasHeight - margin.top - margin.shortBottom;
        // Redraw all
        resize();
      }
    })
    .on('mouseover', function() {
      if (httpOBChartIsFullScreen) {
        d3.select('.httpOBChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24.png');
      } else {
        d3.select('.httpOBChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24.png');
      }
    })
    .on('mouseout', function() {
      if (httpOBChartIsFullScreen) {
        d3.select('.httpOBChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
      } else {
        d3.select('.httpOBChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
      }
    });

function resizeHttpOBChart() {
  httpCanvasWidth = $('#httpOBDiv').width() - 8; // -8 for margins and borders
  httpGraphWidth = httpCanvasWidth - margin.left - margin.right;
  if (httpOBChartIsFullScreen) {
    canvasHeight = $('#httpOBDiv').height() - 100;
    tallerGraphHeight = canvasHeight - margin.top - margin.shortBottom;
  }
  // Redraw placeholder
  httpOBChartPlaceholder
    .attr('x', httpGraphWidth / 2)
    .attr('y', tallerGraphHeight / 2);
  httpOBResize
    .attr('x', httpCanvasWidth - 30)
    .attr('y', 4);
  var chart = d3.select('.httpOBChart');
  chart
    .attr('width', httpCanvasWidth)
    .attr('height', canvasHeight);
  httpOB_xScale = d3.time.scale()
    .range([0, httpGraphWidth]);
  httpOB_xAxis = d3.svg.axis()
    .scale(httpOB_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());
  httpOB_yScale = d3.scale.linear().range([tallerGraphHeight, 0]);
  httpOB_yAxis = d3.svg.axis()
    .scale(httpOB_yScale)
    .orient('left')
    .ticks(5)
    .tickFormat(function(d) {
      return d + 'ms';
    });

  httpOB_xScale.domain(d3.extent(httpOBData, function(d) {
    return d.time;
  }));
  httpOB_yScale.domain([0, d3.max(httpOBData, function(d) {
    return d.longest;
  })]);

  httpOBTitleBox.attr('width', httpCanvasWidth);

  chart.selectAll('circle').remove();
  chart.select('.httpline')
    .attr('d', httpOBline(httpOBData));
  chart.select('.xAxis')
    .attr('transform', 'translate(0,' + tallerGraphHeight + ')')
    .call(httpOB_xAxis);
  chart.select('.yAxis')
    .call(httpOB_yAxis);
  chart.selectAll('point')
    .data(httpOBData)
    .enter().append('circle')
    .attr('r', 4)
    .style('fill', '#5aaafa')
    .style('stroke', 'white')
    .attr('transform',
      'translate(' + margin.left + ',' + margin.top + ')')
    .attr('cx', function(d) { return httpOB_xScale(d.time); })
    .attr('cy', function(d) { return httpOB_yScale(d.longest); })
    .append('svg:title').text(function(d) { // tooltip
      if (d.total === 1) {
        return d.url;
      } else {
        return d.total
        + ' requests\n average duration = '
        + d3.format('.2s')(d.average / 1000)
        + 's\n longest duration = '
        + d3.format('.2s')(d.longest / 1000)
        + 's for URL: ' + d.url;
      }
    });
}
