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

// Line chart for displaying http requests with time and duration
var http_xScale = d3.time.scale().range([0, httpGraphWidth]);
var http_yScale = d3.scale.linear().range([tallerGraphHeight, 0]);
var httpData = [];

var http_xAxis = d3.svg.axis()
    .scale(http_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());

var http_yAxis = d3.svg.axis()
    .scale(http_yScale)
    .orient('left')
    .ticks(5)
    .tickFormat(function(d) {
      return d + 'ms';
    });

var mouseOverHttpGraph = false;

// Define the HTTP request time line
var httpline = d3.svg.line()
    .x(function(d) {
      return http_xScale(d.time);
    })
    .y(function(d) {
      return http_yScale(d.longest);
    });

var httpSVG = d3.select('#httpDiv1')
    .append('svg')
    .attr('width', httpCanvasWidth)
    .attr('height', canvasHeight)
    .attr('class', 'httpChart')
    .on('mouseover', function() {
      mouseOverHttpGraph = true;
    })
    .on('mouseout', function() {
      mouseOverHttpGraph = false;
    });

var httpTitleBox = httpSVG.append('rect')
    .attr('width', httpCanvasWidth)
    .attr('height', 30)
    .attr('class', 'titlebox');

var httpChart = httpSVG.append('g')
    .attr('transform',
      'translate(' + margin.left + ',' + margin.top + ')');

// Create the line
httpChart.append('path')
    .attr('class', 'httpline')
    .attr('d', httpline(httpData));

// Define the axes
httpChart.append('g')
    .attr('class', 'xAxis')
    .attr('transform', 'translate(0,' + tallerGraphHeight + ')')
    .call(http_xAxis);

httpChart.append('g')
    .attr('class', 'yAxis')
    .call(http_yAxis);

// Add the title
httpChart.append('text')
    .attr('x', 7 - margin.left)
    .attr('y', 15 - margin.top)
    .attr('dominant-baseline', 'central')
    .text(localizedStrings.httpRequestsTitle);

// Add the placeholder text
var httpChartPlaceholder = httpChart.append('text')
    .attr('x', httpGraphWidth / 2)
    .attr('y', tallerGraphHeight / 2)
    .attr('text-anchor', 'middle')
    .text(localizedStrings.NoDataMsg);

function updateHttpData(httpRequest) {
  var httpRequestData = JSON.parse(httpRequest);
  if (!httpRequestData) return;
  var httpLength = httpData.length;
  httpRequestData.longest = parseFloat(httpRequestData.longest);
  httpRequestData.average = parseFloat(httpRequestData.average);
  httpRequestData.time = parseInt(httpRequestData.time, 10);
  httpRequestData.total = parseInt(httpRequestData.total, 10);
  if (httpRequestData.total > 0) {
    // Send data to throughput chart so as not to duplicate requests
    // define as global for eslint purposes
    /* global updateThroughPutData:false */
    updateThroughPutData(httpRequestData);
    if (httpLength === 0) {
      // first data - remove "No Data Available" label
      httpChartPlaceholder.attr('visibility', 'hidden');
    }
    // Check to see if the request started before previous request(s)
    if (httpLength > 0 && (httpRequestData.time < httpData[httpLength - 1].time)) {
      var i = httpLength - 1;
      while (i >= 0 && httpRequestData.time < httpData[i].time) {
        i--;
      }
      // Insert the data into the right place
      httpData.splice(i + 1, 0, httpRequestData);
    } else {
      httpData.push(httpRequestData);
    }
  }
  if (httpData.length === 0) return;
  // Only keep 'maxTimeWindow' amount of data
  let currentTime = Date.now();
  var startTime = monitoringStartTime.getTime();
  if (startTime + maxTimeWindow < currentTime) {
    startTime = currentTime - maxTimeWindow;
  }
  if (httpData.length > 1) {
    var d0 = httpData[0];
    while (d0.hasOwnProperty('time') && d0.time < startTime) {
      httpData.shift();
      d0 = httpData[0];
    }
  }
  // Don't redraw graph if mouse is over it (keeps it still for tooltips)
  if (!mouseOverHttpGraph) {
    // Set the input domain for x and y axes
    http_xScale.domain([startTime, currentTime]);
    http_yScale.domain([0, d3.max(httpData, function(d) {
      return d.longest;
    })]);
    http_xAxis.tickFormat(getTimeFormat());

    var selection = d3.select('.httpChart');
    selection.select('.httpline')
      .attr('d', httpline(httpData));
    selection.select('.xAxis')
      .call(http_xAxis);
    selection.select('.yAxis')
      .call(http_yAxis);

    // Re-adjust the points
    var points = selection.selectAll('.point').data(httpData)
      .attr('cx', function(d) { return http_xScale(d.time); })
      .attr('cy', function(d) { return http_yScale(d.longest); });
    points.exit().remove();
    points.enter().append('circle')
      .attr('class', 'point')
      .attr('r', 4)
      .style('fill', '#5aaafa')
      .attr('transform',
        'translate(' + margin.left + ',' + margin.top + ')')
      .attr('cx', function(d) { return http_xScale(d.time); })
      .attr('cy', function(d) { return http_yScale(d.longest); })
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
}

var httpChartIsFullScreen = false;

// Add the maximise/minimise button
var httpResize = httpSVG.append('image')
    .attr('x', httpCanvasWidth - 30)
    .attr('y', 4)
    .attr('width', 24)
    .attr('height', 24)
    .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
    .attr('class', 'maximize')
    .on('click', function(){
      httpChartIsFullScreen = !httpChartIsFullScreen;
      d3.select('#dashboard').selectAll('.hideable')
        .classed('invisible', httpChartIsFullScreen);
      d3.select('#httpDiv1')
        .classed('fullscreen', httpChartIsFullScreen)
        .classed('invisible', false); // remove invisible from this chart
      if (httpChartIsFullScreen) {
        d3.select('.httpChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
        // Redraw this chart only
        resizeHttpChart();
      } else {
        d3.select('.httpChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
        canvasHeight = 250;
        tallerGraphHeight = canvasHeight - margin.top - margin.shortBottom;
        // Redraw all
        resize();
      }
    })
    .on('mouseover', function() {
      if (httpChartIsFullScreen) {
        d3.select('.httpChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24.png');
      } else {
        d3.select('.httpChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24.png');
      }
    })
    .on('mouseout', function() {
      if (httpChartIsFullScreen) {
        d3.select('.httpChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
      } else {
        d3.select('.httpChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
      }
    });

function resizeHttpChart() {
  httpCanvasWidth = $('#httpDiv1').width() - 8; // -8 for margins and borders
  httpGraphWidth = httpCanvasWidth - margin.left - margin.right;
  if (httpChartIsFullScreen) {
    canvasHeight = $('#httpDiv1').height() - 100;
    tallerGraphHeight = canvasHeight - margin.top - margin.shortBottom;
  }

  // Redraw placeholder
  httpChartPlaceholder
    .attr('x', httpGraphWidth / 2)
    .attr('y', tallerGraphHeight / 2);
  httpResize
    .attr('x', httpCanvasWidth - 30)
    .attr('y', 4);
  var chart = d3.select('.httpChart');
  chart
    .attr('width', httpCanvasWidth)
    .attr('height', canvasHeight);
  http_xScale = d3.time.scale()
    .range([0, httpGraphWidth]);
  http_xAxis = d3.svg.axis()
    .scale(http_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());
  http_yScale = d3.scale.linear().range([tallerGraphHeight, 0]);
  http_yAxis = d3.svg.axis()
    .scale(http_yScale)
    .orient('left')
    .ticks(5)
    .tickFormat(function(d) {
      return d + 'ms';
    });
  httpTitleBox.attr('width', httpCanvasWidth);
  let currentTime = Date.now();
  var startTime = monitoringStartTime.getTime();
  if (startTime + maxTimeWindow < currentTime) {
    startTime = currentTime - maxTimeWindow;
  }
  http_xScale.domain([startTime, currentTime]);
  http_yScale.domain([0, d3.max(httpData, function(d) {
    return d.longest;
  })]);
  chart.selectAll('circle').remove();
  chart.select('.httpline')
    .attr('d', httpline(httpData));
  chart.select('.xAxis')
    .attr('transform', 'translate(0,' + tallerGraphHeight + ')')
    .call(http_xAxis);
  chart.select('.yAxis')
    .call(http_yAxis);
  chart.selectAll('point')
    .data(httpData)
    .enter().append('circle')
    .attr('class', 'point')
    .attr('r', 4)
    .style('fill', '#5aaafa')
    .attr('transform',
      'translate(' + margin.left + ',' + margin.top + ')')
    .attr('cx', function(d) { return http_xScale(d.time); })
    .attr('cy', function(d) { return http_yScale(d.longest); })
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
