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

// Test framework.
const request = require('request');
const tap = require('tap');
const util = require('util');

const appmetrics = require('appmetrics');
appmetrics.start();

tap.test('runs dashboard on ephemeral port', function(t) {
  var server = require('../').monitor({
    appmetrics: appmetrics,
    port: 0,
    host: '127.0.0.1',
    console: {
      log: function() { /* ignore */ },
      error: function() { /* ignore */ },
    },
  });

  server.on('listening', function() {
    const a = this.address();
    const base = util.format('http://%s:%s', a.address, a.port);
    const options = {
      url: base + '/appmetrics-dash',
    };
    t.equal(a.address, '127.0.0.1');
    t.comment(util.inspect(options));
    request(options, function(err, resp, body) {
      t.ifError(err);
      t.equal(resp.statusCode, 200);
      t.similar(body, /DOCTYPE html/);
      server.close(t.end);
    });
  });
});
