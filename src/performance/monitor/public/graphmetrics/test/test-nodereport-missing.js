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
'use strict';

const appmetrics = require('appmetrics');
const io = require('socket.io-client');
const tap = require('tap');
const util = require('util');

tap.test('missing nodereport handled gracefully', function(t) {
  var server = require('../').monitor({
    appmetrics: appmetrics,
    nodereport: null,
    port: 0,
    host: '127.0.0.1',
    console: {
      log: function() { /* ignore */ },
      error: function() { /* ignore */ },
    },
  });

  server.on('listening', function() {
    const a = this.address();
    const url = util.format('ws://%s:%s', a.address, a.port);
    const ws = io.connect(url, {
      transport: ['websocket'],
    });
    ws.on('connect', function() {
      ws.emit('nodereport');
      ws.once('nodereport', check);
    });

    function check(msg) {
      t.equal(msg.error, 'node reporting not available');
      close();
    }

    function close() {
      ws.close();
      server.close(t.end);
    }
  });
});
