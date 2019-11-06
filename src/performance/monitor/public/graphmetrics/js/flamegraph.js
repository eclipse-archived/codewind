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

'use strict';

// This holds all tree nodes as an array so we can
// easily pass them to d3.
// This should only be cleared if we start a different profile.
let all_tree_nodes = [];
let max_depth = 0;

// Constructor, creates a TreeNode from a profile node.
function TreeNode(name, file, line, parent_ref = undefined) {
  this.count = 0;
  this.child_count = 0;
  if (parent_ref) {
    this.parent_ref = parent_ref;
    parent_ref.children.push(this);
  } else {
    this.parent_ref = undefined;
  }
  this.children = [];
  this.file = file;
  this.name = name;
  this.line = line;
  this.colour = colours[0];
  this.width = 0;
  this.x_pos = 0;
  this.depth = (parent_ref === undefined) ? 0 : parent_ref.depth + 1;
  this.selected = false;
  this.addTicks = function(ticks) {
    this.count += ticks;
    let next_parent = this.parent_ref;
    while (next_parent) {
      next_parent.child_count += ticks;
      next_parent = next_parent.parent_ref;
    }
  };
  all_tree_nodes.push(this);
  max_depth = Math.max(max_depth, this.depth);
}

// Walk the nodes as a tree to work out plot
// sizes.
function updateNodeAndChildren(current_node, width, x_pos = 0) {
  current_node.width = width;
  current_node.x_pos = x_pos;

  // Stack the children in the middle of the parent.
  let cumulative_count = current_node.child_count + current_node.count;
  let alignment = 0;
  if (cumulative_count > 0) {
    alignment = ((current_node.count / cumulative_count) * width) / 2;
  }

  let child_x_pos = x_pos + alignment;

  for (let child_node of current_node.children) {
   // Width of the child is the fraction of the current width they should occupy.
    let child_width = 0;
    if (cumulative_count > 0) {
      child_width = width * ((child_node.count + child_node.child_count) / cumulative_count);
    }

    updateNodeAndChildren(child_node, child_width, child_x_pos);
    child_x_pos = child_x_pos + child_width;
  }
}

// Four colours should be enough, more might be prettier though.
// let colours = ["red", "orange", "pink", "blue"];
const colours = ['coral', 'tomato', 'orangered', 'gold', 'orange', 'darkorange'];

function setColours() {

  let colour_index = 0;
  let nodes_by_depth = [];

  all_tree_nodes.forEach(node => {
    let row = nodes_by_depth[node.depth] || [];
    row.push(node);
    nodes_by_depth[node.depth] = row;
  });
  nodes_by_depth.forEach(row => {
    row.sort((a, b) => (a.x_pos - b.x_pos));
  });

  function nextColour() {
    colour_index++;
    colour_index = colour_index % colours.length;
    return colours[colour_index];
  }

  // Don't bother setting a colour for the root node.
  nodes_by_depth.slice(1).forEach(row => {
    row.forEach(node => {
      // Hopefully we have more than two colours!
      node.colour = nextColour();
      if (node.colour == node.parent_ref.colour) {
        node.colour = nextColour();
      }
    });
  });

}

let currentSelection = null;

function get_y(node) {
  return flamegraphCanvasHeight - ((node.depth + 1) * flamegraphBoxHeight);
}

function drawFlameGraph(function_calls) {

  setColours();

  // Iterate through the array of data and draw each
  // function call's box.

  svg.selectAll('rect').remove();

  let rectSelection = svg.selectAll('rect')
      .data(function_calls);

  // Set the colour, height and y position for new entries.
  rectSelection
    .enter()
    .append('rect')
    .attr('x', (d, _i) => {
      if (isNaN(d.x_pos)) {
        console.error('NaN x_pos for ' + d.name);
      } else {
        return d.x_pos;
      }
    })
    .attr('y', (d, _i) => get_y(d))
    .attr('width', (d, _i) => {
      if (isNaN(d.width)) {
        console.error('NaN width for ' + d.name);
      } else {
        return d.width;
      }
    })
    .attr('height', flamegraphBoxHeight)
    .attr('label', (d, _i) => d.name)
    .style('fill', (d, _i) => d.colour)
    .style('stroke', 'rgb(0,0,0)')
    .on('click', function(d, _i) {
      if (d == currentSelection) {
        // De-select
        currentSelection = null;
        clearNodeDetails();
      } else {
        currentSelection = d;
        showNodeDetails(d);
      }
      highlightSelectedNode();
      refreshFlameGraph();
    })
    .append('title').text((d, _i) => createStack(d));

  highlightSelectedNode();
}


function highlightSelectedNode() {
  // Set the highlighting and make the selected element the last to be
  // drawn to stop the border being covered on some edges by other rectangles.
  svg.selectAll('rect')
  .style('stroke-width', (d, _i) => d == currentSelection ? 3 : 1)
  .each(function(d, _i) {
    if (d == currentSelection) {
      this.parentElement.appendChild(this);
    }
  });
}

function showNodeDetails(node) {

  // Clear the info for the existing selection.
  detailsTable.selectAll('*').remove();

  let current_node = node;
  let current_total_count = current_node.child_count + current_node.count;
  let total_count = all_tree_nodes[0].child_count + all_tree_nodes[0].count;
  let subStrings = {};
  if (total_count > 0) {
    subStrings.total_percent = ((current_total_count / total_count) * 100).toFixed(1);
    subStrings.current_percent = ((current_node.count / total_count) * 100).toFixed(1);
  } else {
    subStrings.total_percent = '0';
    subStrings.current_percent = '0';
  }
  detailsTable.text(formatTemplate(localizedStrings.flamegraphDetailsTotals, subStrings));

  let list = detailsTable.append('ol')
    .text(localizedStrings.flamegraphCallStackTitle);

  // If current_node == null we won't add new text.
  while (current_node) {
    // Trim off node_modules path if exists.
    let fileName = current_node.file.split('node_modules/').pop();
    let functionName = current_node.name == '' ? '<anonymous function>' : current_node.name;
    let row = list.append('li');
    row.text(`${functionName} (${fileName}:${current_node.line})`);

    current_node = current_node.parent_ref;
  }
}

function clearNodeDetails() {
  // Clear the info for the existing selection.
  detailsTable.selectAll('*').remove();
  detailsTable
    .text(localizedStrings.flamegraphDetailsMsg);
}

function clearFlameGraph() {
  all_tree_nodes = [];
  max_depth = 0;
  flamegraphBoxHeight = 20;
  clearNodeDetails();
  refreshFlameGraph();
}

function createStack(node) {
  let stack = '';
  let current_node = node;
  while (current_node) {
    stack += current_node.name == '' ? '<anonymous function>' : current_node.name;
    stack += '\n';
    current_node = current_node.parent_ref;
  }
  return stack;
}

let flamegraphCanvasHeight;
const flamgegraphBoxMaxHeight = 20;
const flamgegraphBoxMinHeight = 5;
let flamegraphBoxHeight = flamgegraphBoxMaxHeight;

function resizeFlameGraph() {

  // Make sure the width isn't < 0 when the tab isn't shown.
  // let profilingTabWidth = Math.max(0, $('#flameDiv').width() - 8);
  if (showStack == showGraph) {
    svgDiv.attr('class', 'col-md-8');
    detailsDiv.attr('class', 'col-md-4');
  } else if (showGraph && !showStack) {
    svgDiv.attr('class', '');
    detailsDiv.attr('class', 'hidden');
  } else if (!showGraph && showStack) {
    svgDiv.attr('class', 'hidden');
    detailsDiv.attr('class', '');
  }

  let flamegraphMinCanvasHeight = window.innerHeight - 120;

  let heightNeeded = max_depth * flamgegraphBoxMinHeight;
  if (heightNeeded > flamegraphMinCanvasHeight) {
    flamegraphCanvasHeight = heightNeeded;
  } else {
    flamegraphCanvasHeight = flamegraphMinCanvasHeight;
  }

  // -30 from height for the title bar.
  // +1 to max_depth since depth starts at 0
  flamegraphBoxHeight = Math.min(flamgegraphBoxMaxHeight, (flamegraphCanvasHeight - 30) / (max_depth + 1));

  svgCanvas
    .attr('height', flamegraphCanvasHeight);

  detailsDiv
    .style('height', `${flamegraphCanvasHeight}px`);

  detailsTitleSvg.attr('width', $('#detailsDiv').width() + 2);

  detailsTable.style('height', `${$('#detailsDiv').height() - ($('#detailsTitleSvg').height() + 4)}px`);

  resizeGraphIcon
    .attr('x', $('#flameGraph').width() - (24 + 4))
    .attr('y', 4);

  resizeDetailsIcon
    .attr('x', $('#detailsDiv').width() - (24 + 4))
    .attr('y', 4);

}

function refreshFlameGraph() {

  resizeFlameGraph();

  // The first node should always be the root node.
  if (all_tree_nodes.length > 0) {
    // Resize as the height may have changed with new nodes.
    updateNodeAndChildren(all_tree_nodes[0], $('#flameGraph').width());
  }

  drawFlameGraph(all_tree_nodes);
}

let showStack = true;
let showGraph = true;

function toggleGraphMaximiseIcon(hover) {
  let iconType = showStack ? 'max' : 'min';
  let colourType = hover ? '' : '_grey';
  resizeGraphIcon.attr('xlink:href', `graphmetrics/images/${iconType}imize_24${colourType}.png`);
}

function toggleDetailsMaximiseIcon(hover) {
  let iconType = showGraph ? 'max' : 'min';
  let colourType = hover ? '' : '_grey';
  resizeDetailsIcon.attr('xlink:href', `graphmetrics/images/${iconType}imize_24${colourType}.png`);
}

/** Initialise Flame Graph **/

let flameDiv = window.d3.select('#flameDiv');

flameDiv.attr('class', 'container-fluid');

let rowDiv = flameDiv
  .append('div')
  .attr('class', 'row');

let svgDiv = rowDiv.append('div');

let detailsDiv = rowDiv
  .append('div')
  .style('margin-top', '3px')
  .style('padding', '0px')
  .attr('id', 'detailsDiv');
;

let svgCanvas = svgDiv
  .append('svg')
  .attr('width', '100%')
  .attr('height', '100%')
  .attr('class', 'flameGraph')
  .attr('id', 'flameGraph');

let graphTitleGroup = svgCanvas.append('g');

graphTitleGroup
  .append('rect')
  .attr('x', 0)
  .attr('y', 0)
  .attr('width', '100%')
  .attr('height', 30)
  .attr('class', 'titlebox')
  .attr('id', 'flameGraphTitle');

graphTitleGroup.append('text')
  .attr('x', 7)
  .attr('y', 15)
  .attr('dominant-baseline', 'central')
  .text(localizedStrings.flamegraphGraphTitle);

let resizeGraphIcon = graphTitleGroup.append('image')
  .attr('width', 24)
  .attr('height', 24)
  .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
  .attr('class', 'maximize')
  .on('click', function() {
    // TODO - Hide the stack panel and make this bigger.
    showStack = !showStack;
    toggleGraphMaximiseIcon(true);
    refreshFlameGraph();
  })
  .on('mouseover', function() {
    toggleGraphMaximiseIcon(true);
  })
  .on('mouseout', function() {
    toggleGraphMaximiseIcon(false);
  });

// This will be the area we actually draw the flame graph in.
let svg = svgCanvas.append('g');

let detailsTitleSvg = detailsDiv.append('svg')
  .attr('height', 32)
  .attr('id', 'detailsTitleSvg')
  .style('margin', '-1px');

detailsTitleSvg
  .append('rect')
  .attr('x', 0)
  .attr('y', 0)
  .attr('width', '100%')
  .attr('height', 32)
  .attr('class', 'titlebox')
  .attr('id', 'detailsTitle');

detailsTitleSvg.append('text')
  .attr('x', 7)
  .attr('y', 15)
  .attr('dominant-baseline', 'central')
  .text(localizedStrings.flamegraphDetailsTitle);

let resizeDetailsIcon = detailsTitleSvg.append('image')
  .attr('width', 24)
  .attr('height', 24)
  .attr('xlink:href', 'graphmetrics/images/maximize_24_grey.png')
  .attr('class', 'maximize')
  .on('click', function() {
    showGraph = !showGraph;
    toggleDetailsMaximiseIcon(true);
    refreshFlameGraph();
  })
  .on('mouseover', function() {
    toggleDetailsMaximiseIcon(true);
  })
  .on('mouseout', function() {
    toggleDetailsMaximiseIcon(false);
  });

// Empty div for the selected function details text.
let detailsTable = detailsDiv
    .append('div')
    .style('font-family', 'monospace')
    .style('overflow-y', 'auto');


clearNodeDetails();
refreshFlameGraph();
