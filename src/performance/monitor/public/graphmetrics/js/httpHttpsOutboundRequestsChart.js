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
var httpOB_xScale = d3.time.scale().range([0, httpGraphWidth]);
var httpOB_yScale = d3.scale.linear().range([graphHeight, 0]);
var httpOBData = [];
var httpsOBData = [];
var startTime;

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

// https
var httpsOBline = d3.svg.line()
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

var httpOBChart = httpOBSVG.append('g')
  .attr('transform',
    'translate(' + margin.left + ',' + margin.top + ')');

// Create the line
httpOBChart.append('path')
  .attr('class', 'httpline')
  .attr('d', httpOBline(httpOBData));

// Create the https line
httpOBChart.append('path')
  .attr('class', 'httpsline')
  .attr('d', httpsOBline(httpsOBData));

// Define the axes
httpOBChart.append('g')
  .attr('class', 'xAxis')
  .attr('transform', 'translate(0,' + graphHeight + ')')
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
  .attr('y', graphHeight / 2)
  .attr('text-anchor', 'middle')
  .text(localizedStrings.NoDataMsg);

  // Add the http colour box
httpOBChart.append('rect')
  .attr('x', 0)
  .attr('y', graphHeight + margin.bottom - 20)
  .attr('class', 'colourbox3')
  .attr('width', 10)
  .attr('height', 10);

var httpOBLineVisible = true;
var httpsOBLineVisible = true;

// Add the http checkbox
httpOBChart.append('foreignObject')
  .attr('class', 'checkboxHolder')
  .attr('x', 15)
  .attr('y', graphHeight + margin.bottom - 25)
  .attr('width', 30)
  .attr('height', 25)
  .append('xhtml:tree')
  .html('<label class=\'inline\'><input type=\'checkbox\' id=httpOBChartHttpCheckbox checked>' +
     '<span class=\'lbl\'></span></label>')
  .on('click', function(){
    httpOBLineVisible = httpOBSVG.select('#httpOBChartHttpCheckbox').node().checked;
    resizeHttpOBChart();
  });

// Add the HTTP label
var httpOBLabel = httpOBChart.append('text')
  .attr('x', 35)
  .attr('y', graphHeight + margin.bottom - 10)
  .attr('text-anchor', 'start')
  .attr('class', 'lineLabel')
  .text('HTTP');

// Add the https colour box
httpOBChart.append('rect')
  .attr('x', httpOBLabel.node().getBBox().width + 45)
  .attr('y', graphHeight + margin.bottom - 20)
  .attr('width', 10)
  .attr('height', 10)
  .attr('class', 'colourbox4');


// Add the https checkbox
httpOBChart.append('foreignObject')
  .attr('class', 'checkboxHolder')
  .attr('x', httpOBLabel.node().getBBox().width + 60)
  .attr('y', graphHeight + margin.bottom - 25)
  .attr('width', 30)
  .attr('height', 25)
  .append('xhtml:tree')
  .html('<label class=\'inline\'><input type=\'checkbox\' id=httpOBChartHttpsCheckbox checked>' +
     '<span class=\'lbl\'></span></label>')
  .on('click', function(){
    httpsOBLineVisible = httpOBSVG.select('#httpOBChartHttpsCheckbox').node().checked;
    resizeHttpOBChart();
  });

// Add the HTTPS label
httpOBChart.append('text')
  .attr('x', httpOBLabel.node().getBBox().width + 80)
  .attr('y', graphHeight + margin.bottom - 10)
  .attr('class', 'lineLabel2')
  .text('HTTPS');

function updateHttpOBData(httpOBRequest) {
  var httpOBRequestData = JSON.parse(httpOBRequest);
  if (!httpOBRequestData) return;
  var httpOBLength = httpOBData.length;
  httpOBRequestData.longest = parseFloat(httpOBRequestData.longest);
  httpOBRequestData.average = parseFloat(httpOBRequestData.average);
  httpOBRequestData.time = parseInt(httpOBRequestData.time, 10);
  httpOBRequestData.total = parseInt(httpOBRequestData.total, 10);
  if (httpOBRequestData.total > 0) {
    if (httpOBLength === 0) {
      // first data - remove "No Data Available" label
      httpOBChartPlaceholder.attr('visibility', 'hidden');
    }
    // Check to see if the request started before previous request(s)
    if (httpOBLength > 0 && (httpOBRequestData.time < httpOBData[httpOBLength - 1].time)) {
      var i = httpOBLength - 1;
      while (i >= 0 && httpOBRequestData.time < httpOBData[i].time) {
        i--;
      }
      // Insert the data into the right place
      httpOBData.splice(i + 1, 0, httpOBRequestData);
    } else {
      httpOBData.push(httpOBRequestData);
    }
  }
  if (httpOBData.length === 0) return;
  // Only keep 'maxTimeWindow' amount of data
  let currentTime = Date.now();
  if (!startTime)
    startTime = monitoringStartTime.getTime();
  if (startTime + maxTimeWindow < currentTime) {
    startTime = currentTime - maxTimeWindow;
  }
  if (httpOBData.length > 1) {
    var d0 = httpOBData[0];
    while (d0.hasOwnProperty('time') && d0.time < startTime) {
      httpOBData.shift();
      d0 = httpOBData[0];
    }
  }
  // Don't redraw graph if mouse is over it (keeps it still for tooltips)
  if (!mouseOverHttpOBGraph) {
    redrawHttpOBChart();
  }
}

function redrawHttpOBChart() {
  let currentTime = Date.now();
  // Set the input domain for x and y axes
  httpOB_xScale.domain([startTime, currentTime]);
  httpOB_yScale.domain([0, d3.max([d3.max(httpOBData, function(d) {
    return httpOBLineVisible ? d.longest : 0;
  }), d3.max(httpsOBData, function(d) {
    return httpsOBLineVisible ? d.longest : 0;
  })])]);
  httpOB_xAxis.tickFormat(getTimeFormat());

  var selection = d3.select('.httpOBChart');
  selection.select('.httpline')
    .attr('visibility', httpOBLineVisible ? 'visible' : 'hidden')
    .attr('d', httpOBline(httpOBData));
  selection.select('.httpsline')
    .attr('visibility', httpsOBLineVisible ? 'visible' : 'hidden')
    .attr('d', httpsOBline(httpsOBData));
  selection.select('.xAxis')
    .attr('transform', 'translate(0,' + graphHeight + ')')
    .call(httpOB_xAxis);
  selection.select('.yAxis')
    .call(httpOB_yAxis);

  selection.selectAll('circle').remove();

  // Re-adjust the points
  var points = selection.selectAll('.point').data(httpOBData)
    .attr('cx', function(d) { return httpOB_xScale(d.time); })
    .attr('cy', function(d) { return httpOB_yScale(d.longest); });
  // points.exit().remove();
  if (httpOBLineVisible) {
    points.enter().append('circle')
      .attr('class', 'point')
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

  // Re-adjust the points
  var httpsOBPoints = selection.selectAll('.httpsOBPoint').data(httpsOBData)
    .attr('cx', function(d) { return httpOB_xScale(d.time); })
    .attr('cy', function(d) { return httpOB_yScale(d.longest); });
  // httpsPoints.exit().remove();
  if (httpsOBLineVisible) {
    httpsOBPoints.enter().append('circle')
      .attr('class', 'httpsOBPoint')
      .attr('r', 4)
      .style('fill', '#dc267f')
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
}

function updateHttpsOBData(httpOBRequest) {
  var httpOBRequestData = JSON.parse(httpOBRequest);
  if (!httpOBRequestData) return;
  var httpsOBLength = httpsOBData.length;
  httpOBRequestData.longest = parseFloat(httpOBRequestData.longest);
  httpOBRequestData.average = parseFloat(httpOBRequestData.average);
  httpOBRequestData.time = parseInt(httpOBRequestData.time, 10);
  httpOBRequestData.total = parseInt(httpOBRequestData.total, 10);
  if (httpOBRequestData.total > 0) {
    if (httpsOBLength === 0) {
      // first data - remove "No Data Available" label
      httpOBChartPlaceholder.attr('visibility', 'hidden');
    }
    // Check to see if the request started before previous request(s)
    if (httpsOBLength > 0 && (httpOBRequestData.time < httpsOBData[httpsOBLength - 1].time)) {
      var i = httpsOBLength - 1;
      while (i >= 0 && httpOBRequestData.time < httpsOBData[i].time) {
        i--;
      }
      // Insert the data into the right place
      httpsOBData.splice(i + 1, 0, httpOBRequestData);
    } else {
      httpsOBData.push(httpOBRequestData);
    }
  }
  if (httpsOBData.length === 0) return;
  // Only keep 'maxTimeWindow' amount of data
  let currentTime = Date.now();
  if (!startTime)
    startTime = monitoringStartTime.getTime();
  if (startTime + maxTimeWindow < currentTime) {
    startTime = currentTime - maxTimeWindow;
  }
  if (httpsOBData.length > 1) {
    var d0 = httpsOBData[0];
    while (d0.hasOwnProperty('time') && d0.time < startTime) {
      httpsOBData.shift();
      d0 = httpsOBData[0];
    }
  }
  redrawHttpOBChart();
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
      graphHeight = canvasHeight - margin.top - margin.bottom;
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
    graphHeight = canvasHeight - margin.top - margin.bottom;
  }
  // Redraw placeholder
  httpOBChartPlaceholder
    .attr('x', httpGraphWidth / 2)
    .attr('y', graphHeight / 2);
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
  httpOB_yScale = d3.scale.linear().range([graphHeight, 0]);
  httpOB_yAxis = d3.svg.axis()
    .scale(httpOB_yScale)
    .orient('left')
    .ticks(5)
    .tickFormat(function(d) {
      return d + 'ms';
    });
  httpOBTitleBox.attr('width', httpCanvasWidth);
  // Move labels
  chart.select('.colourbox3')
    .attr('y', graphHeight + margin.bottom - 20);
  chart.select('.lineLabel')
    .attr('y', graphHeight + margin.bottom - 10);
  chart.selectAll('.checkboxHolder')
    .attr('y', graphHeight + margin.bottom - 25);
  chart.select('.colourbox4')
    .attr('y', graphHeight + margin.bottom - 20);
  chart.select('.lineLabel2')
    .attr('y', graphHeight + margin.bottom - 10);

  // redraw
  redrawHttpOBChart();
}
