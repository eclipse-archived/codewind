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

const WebSocket = require('ws');
const Logger = require('./utils/Logger');
const log = new Logger('WebSocket.js');
let wss;

function createWebsocketServer(server) {
  wss = new WebSocket.Server({server, path: "/websockets/file-changes/v1"});
  wss.on('connection', function connection(ws, req) {
    log.debug("Client connected: " + req.connection.remoteAddress);
    // PFE does not listen to filewatcher Daemon
  })
}

// Broadcast to all IDEs connected to codewind websocket server
function watchListChanged(data) {
  const watchChangedData = {
    type: "watchChanged",
    projects: []
  }
  watchChangedData.projects.push(data);
  if ( wss && wss.clients){
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(watchChangedData));
      }
    });
  }

}

module.exports.createWebsocketServer = createWebsocketServer;
module.exports.watchListChanged = watchListChanged;