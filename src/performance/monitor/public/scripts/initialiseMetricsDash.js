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

function toggleMenu() {
  $('#sideMenu').toggleClass("expanded");
}

// function toggleProfiling() {
//   if (profiling_enabled) {
//     socket.emit('disableprofiling');
//   } else {
//     socket.emit('enableprofiling');
//   }
// }

const queryStringValues = new URLSearchParams(window.location.search)
if (queryStringValues.get('theme') === 'dark') {
  $('body').addClass("darkmode")
} else {
  $('body').addClass("lightmode")
}

// Global variables
var localizedStrings = {};
var monitoringStartTime = new Date();
var maxTimeWindow = 900000; // 15 minutes

// Initialise graph and canvas dimensions
var margin = {
  top: 50,
  right: 20,
  bottom: 50,
  shortBottom: 30,
  left: 60
},
  canvasWidth = $("#cpuDiv1").width() - 8, // -8 for margins and borders
  httpCanvasWidth = $("#httpDiv1").width() - 8,
  graphWidth = canvasWidth - margin.left - margin.right,
  httpGraphWidth = httpCanvasWidth - margin.left - margin.right,
  canvasHeight = 250,
  tallerGraphHeight = canvasHeight - margin.top - margin.shortBottom,
  graphHeight = canvasHeight - margin.top - margin.bottom;

// // User may have requested appmetrics-dash/index.html
let dashboardRoot = location.pathname.split('index.html')[0] || '/';

function getTimeFormat() {
  var currentTime = new Date()
  if (currentTime.getMinutes() - monitoringStartTime.getMinutes() >= 3 ||
    currentTime.getHours() > monitoringStartTime.getHours()) {
    return d3.time.format("%H:%M");
  } else {
    return d3.time.format("%H:%M:%S");
  }
}

populateLocalizedStrings();
