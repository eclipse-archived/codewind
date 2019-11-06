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

// divName - the div where this should insert itself.
// parentName - the parent containing everything else on the page/tab
// that should be minimised when this is maximised.
// title - A string title for this text table.
function Top5(divName, parentName, title) {

  // Bar chart for top 5 URLs by average request time
  let top5Data = [];
  let top5options = {};

  // TODO - This should probably be a parameter to the constructor
  // or an argument to resizeTable().
  let tableHeight = 250;

  let top5_barHeight = tallerGraphHeight / 5;
  // -8 for margin and border, min 100 in case this is on a hidden tab.
  let canvasWidth = Math.max($(divName).width() - 8, 100);
  let graphWidth = canvasWidth - margin.left - margin.right;
  let graphHeight = tableHeight - margin.top - margin.bottom;
  let top5_xScale = d3.scale.linear().range([0, graphWidth]);

  let top5SVG = d3.select(divName)
  .append('svg')
  .attr('class', 'httpTop5Chart');

  let top5TitleBox = top5SVG.append('rect')
  .attr('height', 30)
  .attr('class', 'titlebox');

  let top5Chart = top5SVG.append('g')
  .attr('transform',
  'translate(' + margin.left + ',' + margin.top + ')');

  // Add the title
  top5Chart.append('text')
  .attr('x', 7 - margin.left)
  .attr('y', 15 - margin.top)
  .attr('dominant-baseline', 'central')
  .text(title);

  // Add the placeholder text
  let top5ChartPlaceholder = top5Chart.append('text')
  .attr('text-anchor', 'middle')
  .text(localizedStrings.NoDataMsg);

  function convertURL(url, graphWidth) {
    let stringToDisplay = url.toString();
    if (stringToDisplay.startsWith('http://' + top5options.host)) {
      stringToDisplay = stringToDisplay.substring(top5options.host.length + 7);
    }
    // Do a rough calculation to find out whether the URL will need more space than is available and truncate if it does
    let stringLength = stringToDisplay.length;
    let charSpaceAvailable = Math.floor(graphWidth / 8); // allow 8 pixels per character (higher than needed but allows space for the time at the end)
    if (stringLength > charSpaceAvailable) {
      stringToDisplay = '...' + stringToDisplay.substring(stringLength - charSpaceAvailable - 3);
    }
    return stringToDisplay;
  }

  let top5ChartIsFullScreen = false;

  // Add the maximise button
  let top5Resize = top5SVG.append('image')
  .attr('width', 24)
  .attr('height', 24)
  .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
  .attr('class', 'maximize')
  .on('click', function(){
    top5ChartIsFullScreen = !top5ChartIsFullScreen;
    d3.select(parentName).selectAll('.hideable').classed('invisible', top5ChartIsFullScreen);
    d3.select(divName)
    .classed('fullscreen', top5ChartIsFullScreen)
    .classed('invisible', false); // remove invisible from this chart
    if (top5ChartIsFullScreen) {
      top5Resize.attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
      // Redraw this chart only
      resizeTop5Chart();
    } else {
      canvasWidth = $(divName).width() - 8; // -8 for margins and borders
      graphWidth = canvasWidth - margin.left - margin.right;
      top5Resize.attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
      tableHeight = 250;
      graphHeight = tableHeight - margin.top - margin.bottom;
      // Redraw all
      resize();
    }
  })
  .on('mouseover', function() {
    if (top5ChartIsFullScreen) {
      top5Resize.attr('xlink:href', 'graphmetrics/images/minimize_24.png');
    } else {
      top5Resize.attr('xlink:href', 'graphmetrics/images/maximize_24.png');
    }
  })
  .on('mouseout', function() {
    if (top5ChartIsFullScreen) {
      top5Resize.attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
    } else {
      top5Resize.attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
    }
  });

  function updateChart() {
    top5_xScale.domain([0, d3.max(top5Data, function(d) {
      return d.averageResponseTime;
    })]);
    d3.select('.httpTop5Chart').selectAll('.bar')
    .remove();
    let bar = d3.select('.httpTop5Chart').selectAll('.bar')
    .data(top5Data)
    .enter().append('g')
    .attr('class', 'bar')
    .attr('transform', function(d, i) {
      return 'translate(50,' + (margin.top + i * top5_barHeight) + ')';
    });
    // Background
    bar.append('rect')
    .attr('width', graphWidth)
    .attr('height', top5_barHeight - 4)
    .style('fill', '#9fa7a7');
    bar.append('rect')
    .attr('width', function(d) {
      return top5_xScale(d.averageResponseTime);
    })
    .attr('height', top5_barHeight - 4);
    bar.append('text')
    .attr('x', 2)
    .attr('y', top5_barHeight / 2)
    .attr('dy', '.35em')
    .attr('fill', 'white')
    .text(function(d) {
      return convertURL(d.url, graphWidth);
    });
    bar.append('text')
    .attr('x', graphWidth - 2)
    .attr('y', top5_barHeight / 2)
    .attr('text-anchor', 'end')
    .attr('fill', 'white')
    .attr('dy', '.35em')
    .text(function(d) {
      return d3.format(',.2f')(d.averageResponseTime) + 'ms';
    });
    // Tooltip
    bar.append('svg:title')
    .text(function(d) { return d.url; });
  }

  function updateHttpAverages(workingData) {
    top5Data = workingData.sort(function(a, b) {
      if (a.averageResponseTime > b.averageResponseTime) {
        return -1;
      }
      if (a.averageResponseTime < b.averageResponseTime) {
        return 1;
      }
      // a must be equal to b
      return 0;
    });
    if (top5options['filteredPath']) {
      top5Data = top5Data.filter((d) => {
        return !((d.url == top5options.filteredPath) ||
        d.url.startsWith(top5options.filteredPath + '/'));
      });
    }
    if (top5Data.length > 5) {
      top5Data = top5Data.slice(0, 5);
    }
    updateChart();
  }

  // Sets the hostname to hide and
  // and path to filter from the top 5.
  // (The path to the dashboard.)
  function settop5Options(options) {
    top5options = options;
  }

  function updateURLData(data) {
    if (top5Data.length == 0) {
      // first data - remove "No Data Available" label
      top5ChartPlaceholder.attr('visibility', 'hidden');
    }
    let top5RequestData = JSON.parse(data);  // parses the data into a JSON array
    updateHttpAverages(top5RequestData);
  }

  function resizeTop5Chart() {
    if (top5ChartIsFullScreen) {
      tableHeight = $(divName).height() - 100;
    }
    canvasWidth = Math.max($(divName).width() - 8, 100);
    graphWidth = canvasWidth - margin.left - margin.right;
    top5Resize
      .attr('x', canvasWidth - 30)
      .attr('y', 4);
    top5ChartPlaceholder
      .attr('x', graphWidth / 2)
      .attr('y', graphHeight / 2);
    top5_xScale = d3.scale.linear().range([0, graphWidth]);
    top5SVG
      .attr('width', canvasWidth)
      .attr('height', tableHeight);
    top5TitleBox
      .attr('width', canvasWidth);
    updateChart();
  }

  // Resize at the end of setup.
  resizeTop5Chart();
  updateChart();

  let exports = {};
  exports.resizeTop5Chart = resizeTop5Chart;
  exports.updateURLData = updateURLData;
  exports.settop5Options = settop5Options;

  return exports;
}
