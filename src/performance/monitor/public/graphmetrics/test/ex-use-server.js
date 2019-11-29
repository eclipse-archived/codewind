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

const options = {
  cert: require('fs').readFileSync(__dirname + '/ec-cert.pem'),
  key: require('fs').readFileSync(__dirname + '/ec-key.pem'),
};
const port = 'PORT' in process.env ? process.env.PORT : 3000;
const server = process.env.HTTPS ?
  require('https').createServer(options) :
  require('http').createServer();

server.listen(port, 'localhost', function() {
  const a = this.address();
  console.log('listening on %s:%s', a.address, a.port);
});

server.on('request', function(req, res) {
  res.write('This is the app!');
  res.end();
});

require('../').monitor({
  appmetrics: require('appmetrics'),
  server: server,
});
