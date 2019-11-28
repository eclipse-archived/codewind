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

// Line chart for displaying average http request response time at a given point in time

var httpDiv2CanvasWidth = $('#httpDiv2').width() - 8; // minus 8 for margin
                                                        // and border
var httpDiv2GraphWidth = httpDiv2CanvasWidth - margin.left - margin.right;

// set the scale dimensions to the size of the graph
var httpTP_xScale = d3.time.scale().range([0, httpDiv2GraphWidth]);
var httpTP_yScale = d3.scale.linear().range([tallerGraphHeight, 0]);

var httpRate = [];

// x axis format
var httpTP_xAxis = d3.svg.axis().scale(httpTP_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());

// y axis format, in requests per second
var httpTP_yAxis = d3.svg.axis()
    .scale(httpTP_yScale)
    .orient('left')
    .ticks(5)
    .tickFormat(function(d) {
      return d + ' rps';
    });

// line plot function
var httpThroughPutline = d3.svg.line()
    .x(function(d) {
      return httpTP_xScale(d.time);
    })
    .y(function(d) {
      return httpTP_yScale(d.httpRate);
    });

// create the chart canvas
var httpThroughPutSVG = d3.select('#httpDiv2')
    .append('svg')
    .attr('width', httpDiv2CanvasWidth)
    .attr('height', canvasHeight)
    .attr('class', 'httpThroughPutChart');

var httpThroughPutTitleBox = httpThroughPutSVG.append('rect')
    .attr('width', httpDiv2CanvasWidth)
    .attr('height', 30)
    .attr('class', 'titlebox');

var httpThroughPutChart = httpThroughPutSVG.append('g')
    .attr('transform',
      'translate(' + margin.left + ',' + margin.top + ')');

// Scale the X range to the time period we have data for
httpTP_xScale.domain(d3.extent(httpRate, function(d) {
  return d.time;
}));

// Scale the Y range from 0 to the maximum http rate
httpTP_yScale.domain([0, d3.max(httpRate, function(d) {
  return d.httpRate;
})]);

// The data line
httpThroughPutChart.append('path')
    .attr('class', 'httpline')
    .attr('d', httpThroughPutline(httpRate));

// X axis line
httpThroughPutChart.append('g')
    .attr('class', 'xAxis')
    .attr('transform', 'translate(0,' + tallerGraphHeight + ')')
    .call(httpTP_xAxis);

// Y axis line
httpThroughPutChart.append('g')
    .attr('class', 'yAxis')
    .call(httpTP_yAxis);

// Chart title
httpThroughPutChart.append('text')
    .attr('x', 7 - margin.left)
    .attr('y', 15 - margin.top)
    .attr('dominant-baseline', 'central')
    .text(localizedStrings.httpThroughPutTitle);

// Add the placeholder text
var httpTPChartPlaceholder = httpThroughPutChart.append('text')
    .attr('x', httpDiv2GraphWidth / 2)
    .attr('y', graphHeight / 2)
    .attr('text-anchor', 'middle')
    .text(localizedStrings.NoDataMsg);

var runningTotal = 0;

function updateThroughPutData(httpThroughPutRequestData) {
  if (httpRate.length === 1) {
    // second data point - remove "No Data Available" label
    httpTPChartPlaceholder.attr('visibility', 'hidden');
  }
  var d = httpThroughPutRequestData; // [i];
  if (d != null && d.hasOwnProperty('time')) {
    if (httpRate.length == 0) {
      httpRate.push({httpRate: 0, time: d.time});
    } else {
      // calculate the new http rate
      var timeDifference = d.time / 1000 - httpRate[httpRate.length - 1].time / 1000;
      if (timeDifference >= 2) {
        var averageRate = (d.total + runningTotal) / timeDifference;
        httpRate.push({httpRate: averageRate, time: d.time});
        runningTotal = 0;
      } else {
        // don't plot this point if less than 2 seconds has elapsed as we can get skewed graphs.
        runningTotal += d.total;
      }
    }
  }
  // Only keep 30 minutes of data
  var currentTime = Date.now();
  var d0 = httpRate[0];
  while (d0.time + maxTimeWindow < currentTime) {
    httpRate.shift();
    d0 = httpRate[0];
  }
  // Re-scale the x range to the new time interval
  httpTP_xScale.domain(d3.extent(httpRate, function(d) {
    return d.time;
  }));
  // Re-scale the y range to the new maximum http rate
  httpTP_yScale.domain([0, d3.max(httpRate, function(d) {
    return d.httpRate;
  })]);
  // update the data and axes lines to the new data values
  var selection = d3.select('.httpThroughPutChart');
  selection.select('.httpline')
    .attr('d', httpThroughPutline(httpRate));
  selection.select('.xAxis')
    .call(httpTP_xAxis);
  selection.select('.yAxis')
    .call(httpTP_yAxis);
}

var httpTPChartIsFullScreen = false;

// Add the maximise/minimise button
var httpTPResize = httpThroughPutSVG.append('image')
    .attr('x', httpDiv2CanvasWidth - 30)
    .attr('y', 4)
    .attr('width', 24)
    .attr('height', 24)
    .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
    .attr('class', 'maximize')
    .on('click', function(){
      httpTPChartIsFullScreen = !httpTPChartIsFullScreen;
      d3.select('#dashboard').selectAll('.hideable')
        .classed('invisible', httpTPChartIsFullScreen);
      d3.select('#httpDiv2')
        .classed('fullscreen', httpTPChartIsFullScreen)
        .classed('invisible', false); // remove invisible from this chart
      if (httpTPChartIsFullScreen) {
        d3.select('.httpThroughPutChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
        // Redraw this chart only
        resizeHttpThroughputChart();
      } else {
        canvasHeight = 250;
        tallerGraphHeight = canvasHeight - margin.top - margin.shortBottom;
        // Redraw all
        resize();
      }
    })
    .on('mouseover', function() {
      if (httpTPChartIsFullScreen) {
        d3.select('.httpThroughPutChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24.png');
      } else {
        d3.select('.httpThroughPutChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24.png');
      }
    })
    .on('mouseout', function() {
      if (httpTPChartIsFullScreen) {
        d3.select('.httpThroughPutChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
      } else {
        d3.select('.httpThroughPutChart .maximize')
          .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
      }
    });

function resizeHttpThroughputChart() {
  if (httpTPChartIsFullScreen) {
    canvasHeight = $('#httpDiv2').height() - 100;
    tallerGraphHeight = canvasHeight - margin.top - margin.shortBottom;
  }
  httpDiv2CanvasWidth = $('#httpDiv2').width();
  httpDiv2GraphWidth = httpDiv2CanvasWidth - margin.left - margin.right;
  // Redraw placeholder
  httpTPChartPlaceholder
    .attr('x', httpDiv2GraphWidth / 2)
    .attr('y', tallerGraphHeight / 2);
  httpTPResize
    .attr('x', httpDiv2CanvasWidth - 30)
    .attr('y', 4);
  var chart = d3.select('.httpThroughPutChart');
  chart
    .attr('width', httpDiv2CanvasWidth)
    .attr('height', canvasHeight);
  httpTP_xScale = d3.time.scale().range([0, httpDiv2GraphWidth]);
  httpTP_xAxis = d3.svg.axis()
    .scale(httpTP_xScale)
    .orient('bottom')
    .ticks(3)
    .tickFormat(getTimeFormat());
  httpTP_yScale = d3.scale.linear().range([tallerGraphHeight, 0]);
  httpTP_yAxis = d3.svg.axis()
    .scale(httpTP_yScale)
    .orient('left')
    .ticks(5)
    .tickFormat(function(d) {
      return d + ' rps';
    });
  httpThroughPutTitleBox.attr('width', httpDiv2CanvasWidth);
  // Re-scale the x range to the new time interval
  httpTP_xScale.domain(d3.extent(httpRate, function(d) {
    return d.time;
  }));
  // Re-scale the y range to the new maximum http rate
  httpTP_yScale.domain([0, d3.max(httpRate, function(d) {
    return d.httpRate;
  })]);
  // update the data and axes lines to the new data values
  var selection = d3.select('.httpThroughPutChart');
  selection.select('.httpline')
    .attr('d', httpThroughPutline(httpRate));
  selection.select('.xAxis')
    .attr('transform', 'translate(0,' + tallerGraphHeight + ')')
    .call(httpTP_xAxis);
  selection.select('.yAxis')
    .call(httpTP_yAxis);
}
