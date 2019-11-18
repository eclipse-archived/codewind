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
function HttpSummary(divName, parentName, title) {
  let httpSummaryData = [];
  let httpSummaryOptions = {};
  var sort = {key: 'url', reverse: false};
  let height = 250;
  let minHeight = height;

  // unicode for arrows
  let arrowUp = '&#9650;';
  let arrowDown = '&#9660;';

  function calculateTableHeight() {
    // TODO - This should probably be a parameter to the constructor
    // or an argument to resizeTable().
    height = 250;
    // If the div has class of 'height-2' (Double height div) change tableHeight
    if ($(divName).hasClass('height-2')) {
      // TODO - This should be dynamic, at the moment it isn't
      // as other heights are not dynamic either
      height = 510;
    } else if ($(divName).hasClass('height-fill')) {
      minHeight = 510; // Height of two divs - needs to be dynamic when above is
      height = fillScreenHeight(minHeight);
    }
    return height;
  }


  const normalTableHeight = calculateTableHeight();
  let tableHeight = normalTableHeight;

  // -8 for margin and border, min 100 in case this is on a hidden tab.
  let canvasWidth = Math.max($(divName).width() - 8, 100);
  let graphWidth = canvasWidth - margin.left - margin.right;
  let graphHeight = tableHeight - margin.top - margin.bottom;

  let httpSummarySVG = d3.select(divName)
  .append('svg')
  .attr('class', 'httpSummaryChart');

  // Set titleBoxHeight here as we use it for the graph div below
  let titleBoxHeight = 30;
  let httpSummaryTitleBox = httpSummarySVG.append('rect')
  .attr('height', titleBoxHeight)
  .attr('class', 'titlebox');

  let httpSummaryChart = httpSummarySVG.append('g')
  .attr('transform',
  'translate(' + margin.left + ',' + margin.top + ')');

  // Add the title
  httpSummaryChart.append('text')
  .attr('x', 7 - margin.left)
  .attr('y', 15 - margin.top)
  .attr('dominant-baseline', 'central')
  .text(title);

  // Add the placeholder text
  let httpSummaryChartPlaceholder = httpSummaryChart.append('text')
  .attr('text-anchor', 'middle')
  .text(localizedStrings.NoDataMsg);

  let httpSummaryIsFullScreen = false;

  // Add the maximise button
  let summaryResize = httpSummarySVG.append('image')
  .attr('width', 24)
  .attr('height', 24)
  .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
  .attr('class', 'maximize')
  .on('click', function(){
    httpSummaryIsFullScreen = !httpSummaryIsFullScreen;
    d3.select(parentName).selectAll('.hideable').classed('invisible', httpSummaryIsFullScreen);
    d3.select(divName)
    .classed('fullscreen', httpSummaryIsFullScreen)
    .classed('invisible', false); // remove invisible from this chart
    if (httpSummaryIsFullScreen) {
      summaryResize.attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
      // Redraw this chart only
      resizeTable();
    } else {
      canvasWidth = $(divName).width() - 8; // -8 for margins and borders
      graphWidth = canvasWidth - margin.left - margin.right;
      summaryResize.attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
      tableHeight = normalTableHeight;
      $(divName).parent().attr('style', 'position: relative');
      graphHeight = tableHeight - margin.top - margin.bottom;
      // Redraw all
      resize();
    }
  })
  .on('mouseover', function() {
    if (httpSummaryIsFullScreen) {
      summaryResize.attr('xlink:href', 'graphmetrics/images/minimize_24.png');
    } else {
      summaryResize.attr('xlink:href', 'graphmetrics/images/maximize_24.png');
    }
  })
  .on('mouseout', function() {
    if (httpSummaryIsFullScreen) {
      summaryResize.attr('xlink:href', 'graphmetrics/images/minimize_24_grey.png');
    } else {
      summaryResize.attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png');
    }
  });

  // Attempt to add foreign object to http summary for list
  // summarydiv
  let httpSummaryContent = httpSummarySVG.append('foreignObject')
  .attr('width', graphWidth)
  .attr('height', (tableHeight - titleBoxHeight))
  .attr('x', '0')
  .attr('y', titleBoxHeight)
  .attr('class', 'httpSummaryContent');

  let httpSummaryDiv = httpSummaryContent
  .append('xhtml:body')
  .append('xhtml:div')
  .attr('class', 'httpSummaryDiv');

  let httpSummaryTableTitles = httpSummaryDiv.append('xhtml:div')
  .attr('class', 'httpSummaryTableHeaderDiv')
  .append('xhtml:table');

  // Set titles for table
  let httpSummaryTableTitlesRow = httpSummaryTableTitles.append('xhtml:tr');
  httpSummaryTableTitlesRow.append('xhtml:td').attr('class', 'httpSummaryTableHeader active')
    .text('Endpoint').attr('id', 'url').append('xhtml:span').html(arrowDown);
  httpSummaryTableTitlesRow.append('xhtml:td').attr('class', 'httpSummaryTableHeader')
    .text('Total Hits').attr('id', 'hits').append('xhtml:span');
  httpSummaryTableTitlesRow.append('xhtml:td').attr('class', 'httpSummaryTableHeader')
    .text('Average Response Time (ms)').attr('id', 'averageResponseTime').append('xhtml:span');
  httpSummaryTableTitlesRow.append('xhtml:td').attr('class', 'httpSummaryTableHeader')
    .text('Longest Response Time (ms)').attr('id', 'longestResponseTime').append('xhtml:span');

  let httpSummaryContentDivHeight = tableHeight - (40 + titleBoxHeight + $('.httpSummaryTableHeaderDiv').height());
  let httpSummaryContentDiv = httpSummaryDiv.append('xhtml:div')
  .attr('class', 'httpSummaryContentDiv')
  .attr('cellspacing', '0')
  .attr('cellpadding', '0')
  .attr('style', 'height: ' + httpSummaryContentDivHeight + 'px');

  let httpSummaryContentTable = httpSummaryContentDiv.append('xhtml:table');

  function updateChart() {
    httpSummaryContentTable.html('');
    for (var i = 0; i < httpSummaryData.length; i++) {
      let row = httpSummaryContentTable.append('xhtml:tr');
      row.append('xhtml:td').text(httpSummaryData[i].url);
      row.append('xhtml:td').text(httpSummaryData[i].hits);
      // Round averageResponseTime to two decimal
      let averageTime = Number(httpSummaryData[i].averageResponseTime).toFixed(2);
      row.append('xhtml:td').text(averageTime);
      let longestTime = Number(httpSummaryData[i].longestResponseTime).toFixed(2);
      row.append('xhtml:td').text(longestTime);
    }
  }

  function updateHttpAverages(workingData) {
    httpSummaryData = sorting(workingData, sort.key);
    if (httpSummaryOptions['filteredPath']) {
      httpSummaryData = httpSummaryData.filter((d) => {
        return !((d.url == httpSummaryOptions.filteredPath) ||
        d.url.startsWith(httpSummaryOptions.filteredPath + '/'));
      });
    }

    function sorting(objectToSort, key) {
      function sortByKey(a, b) {
        var x = a[key];
        var y = b[key];
        return ((x < y) ? 1 : ((x > y) ? -1 : 0));
      }
      objectToSort.sort(sortByKey);
      if (sort.reverse) {
        objectToSort.reverse(sortByKey);
      }
      return objectToSort;
    }

    updateChart();
  }

  // Sets the hostname to hide and
  // and path to filter from the top 5.
  // (The path to the dashboard.)
  function setHttpSummaryOptions(options) {
    httpSummaryOptions = options;
  }

  function updateURLData(data) {
    if (httpSummaryData.length == 0) {
      // first data - remove "No Data Available" label
      httpSummaryChartPlaceholder.attr('visibility', 'hidden');
    }
    let httpSummaryRequestData = JSON.parse(data);  // parses the data into a JSON array
    updateHttpAverages(httpSummaryRequestData);
  }

  function resizeTable() {
    if (httpSummaryIsFullScreen) {
      // Make sure that the height doesn't change if its already full
      if (!($(divName).hasClass('height-fill'))) {
        tableHeight = $(divName).height() - 100;
        if ($(divName).hasClass('height-2')) {
          $(divName).parent().attr('style', 'position: absolute');
        }
      }
    }
    if ($(divName).hasClass('height-fill')) {
      tableHeight = fillScreenHeight(minHeight);
    }
    canvasWidth = Math.max($(divName).width() - 8, 100);
    graphWidth = canvasWidth - margin.left - margin.right;
    summaryResize
      .attr('x', canvasWidth - 30)
      .attr('y', 4);
    httpSummaryChartPlaceholder
      .attr('x', graphWidth / 2)
      .attr('y', graphHeight / 2);
    httpSummarySVG
      .attr('width', canvasWidth)
      .attr('height', tableHeight);
    httpSummaryTitleBox
      .attr('width', canvasWidth);
    httpSummaryContent
      .attr('width', canvasWidth)
      .attr('height', (tableHeight - titleBoxHeight));
    httpSummaryContentDivHeight = tableHeight - (40 + titleBoxHeight + $('.httpSummaryTableHeaderDiv').height());
    httpSummaryContentDiv
      .attr('style', 'height: ' + httpSummaryContentDivHeight + 'px');
    scrollBarCorrection();
    updateChart();
  }

  // Correct the size of the table titles
  // by adding padding-right to its div based
  // on the width of the scroll bar on screen
  function scrollBarCorrection() {
    let outerWidth = $('.httpSummaryContentDiv:eq(0)').outerWidth();
    let innerWidth = $('.httpSummaryContentDiv:eq(0) table').outerWidth();
    let padding = outerWidth - innerWidth;
    // Add padding to httpSummaryTableHeaderDiv
    // httpSummaryContentDiv has a padding-left of 1
    if (padding > 1) {
      $('.httpSummaryTableHeaderDiv').css('padding-right', padding + 'px');
    } else {
      // If no scroll bar add 10px to the padding right
      $('.httpSummaryDiv');
    }
  }

  // Function to sort the data depending on how the user wants it to be ordered
  function sortData(e) {
    if (!e) e = window.event;
    let switchCase = e.target.id.toString();
    // If the sort icon is clicked instead, get the id of its parent
    if (e.target.tagName === 'SPAN') {
      switchCase = ($(e.target).parent().attr('id')).toString();
    }
    switch (switchCase) {
      case sort.key:
        sort.reverse = !sort.reverse;
        break;
      case 'url':
        sort.key = 'url';
        sort.reverse = false;
        break;
      case 'hits':
        sort.key = 'hits';
        sort.reverse = false;
        break;
      case 'averageResponseTime':
        sort.key = 'averageResponseTime';
        sort.reverse = false;
        break;
      case 'longestResponseTime':
        sort.key = 'longestResponseTime';
        sort.reverse = false;
        break;
      default:
        console.error('Not a sortable element');
    }
    updateSortArrows();
    updateHttpAverages(httpSummaryData);
  }

  // Function to update which arrow is shown on the screen to indicate sorting
  function updateSortArrows() {
    // The sort.key will always be the same as an id for
    // one of the three fields in the table
    $('.httpSummaryTableHeader span').html('');
    let arrow = arrowDown;
    if (sort.reverse) {
      arrow = arrowUp;
    }
    $('#' + sort.key + ' span').html(arrow);

    // Update the active element and give it a border
    $('.httpSummaryTableHeader').removeClass('active');
    $('#' + sort.key).addClass('active');
  }

  // Resize at the end of setup.
  resizeTable();
  updateChart();

  // Onclick of table header, sort data
  $('.httpSummaryTableHeaderDiv td').click(sortData);

  let exports = {};
  exports.resizeTable = resizeTable;
  exports.updateURLData = updateURLData;
  exports.setHttpSummaryOptions = setHttpSummaryOptions;

  return exports;
}

// Functions that don't need to be in the httpSummary object
function fillScreenHeight(minHeight) {
  // Set height to the rest of the page
  let body = document.getElementsByTagName('BODY')[0].offsetHeight;
  let nav = document.getElementsByClassName('nav')[0].offsetHeight;
  let header = document.getElementsByClassName('headerDiv')[0].offsetHeight;
  let height = body - (nav + header) - 20;
  if (height < minHeight) {
    return minHeight;
  }
  return height;
}
