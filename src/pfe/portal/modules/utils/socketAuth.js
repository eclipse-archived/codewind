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

const jwt = require('jsonwebtoken');
const socketAuth = require('socketio-auth');
const cwUtils = require('./sharedFunctions');
const Logger = require('./Logger');
const log = new Logger('socketAuth.js');

// Verify UI Socket user has a valid token
module.exports.verifySocketUser = function verifySocketUser (token, keycloakPublicKey) {
  return new Promise((resolve, reject) => {
    log.trace(`UISocket : [verifySocketUser] - token: ${token} `)
    log.trace(`UISocket : [verifySocketUser] - publickey: ${keycloakPublicKey}`)
    jwt.verify(token, keycloakPublicKey, function (err, decoded) {
      if (err) {
        log.error(`UISocket : [verifySocketUser] - ${err.message}s`)
        log.trace(err);
      }
      if (decoded) {
        log.info("UISocket : [verifySocketUser] - Token decoded successfully");
        return resolve(decoded);
      }
      return false
    });
    return reject('USER_NOT_FOUND');
  });
};

// fetch the public key from Keycloak service
module.exports.getKeycloakPublicKey = async function getKeycloakPublicKey() {
  const currentTLSReject = process.env["NODE_TLS_REJECT_UNAUTHORIZED"]
  const BEGIN_KEY = '-----BEGIN PUBLIC KEY-----\n';
  const END_KEY = '\n-----END PUBLIC KEY-----\n';
  const secRealm = process.env.CODEWIND_AUTH_REALM;
  const secKeycloakHost = process.env.CODEWIND_AUTH_HOST; // hostname (without http:// or https://)
  const certsURL = `/auth/realms/${secRealm}`
  let options = {
    host: secKeycloakHost,
    path: certsURL,
    method: 'GET',
  }

  // Fetch realm keys
  log.info(`UISocket : [getKeycloakPublicKey] - fetching certs`);
  try {
    // turn off checking temporarily
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
    const response = await cwUtils.asyncHttpRequest(options, "", true);
    // revert tls check
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = currentTLSReject;

    switch (response.statusCode) {
    case 200: {
      log.debug(`UISocket : [getKeycloakPublicKey] - parsing certs`);
      const certs = JSON.parse(response.body);
      log.debug(`UISocket : [getKeycloakPublicKey] - response: ${certs}`);
      if (certs.public_key) {
        const publicKey = BEGIN_KEY + certs.public_key + END_KEY
        log.debug(`UISocket : [getKeycloakPublicKey] - key: ${publicKey}`);
        return publicKey
      }
      break;
    }
    default: {
      log.error(`UISocket : [getKeycloakPublicKey] - unable to fetch public key ${secKeycloakHost}${certsURL}`);
      break;
    }
    }
  } catch (err) {
    log.error('UISocket : [getKeycloakPublicKey] - error retrieving keys');
    log.error(err);
  }
  return "";
}

// Add a socket authenticator to the UI Socket
module.exports.addAuthenticationToUISocket = async function addAuthenticationToUISocket(uiSocket) {
  // cache the public key from Keycloak to avoid polling on each connection
  let keycloakPublicKey = null
  try {
    keycloakPublicKey = await this.getKeycloakPublicKey();
    log.info(`keycloakPublicKey = \n${keycloakPublicKey}`);
  } catch (err) {
    console.dir(err);
  }

  socketAuth(uiSocket, {
    authenticate: async (socket, data, callback) => {
      log.info("UISocket : [pre-authenticate]");
      const { token } = data;
      try {
        const authenticatedSocket = await this.verifySocketUser(token, keycloakPublicKey);
        socket.user = authenticatedSocket;
        return callback(null, true);
      } catch (e) {
        log.info(`UISocket : [authenticate] - ${socket.id} unauthorized: ${e}`);
        return callback({ message: `${e}` });
      }
    },
    postAuthenticate: (socket) => {
      log.info(`UISocket : [postAuthenticate] - ${socket.id} authenticated.`);
      // Send a ping every 5 seconds to connected clients
      if (process.env.DEBUG_SOCKET_PING) {
        setInterval(function () { socket.emit('socket-ping', { message: "Ping" }); }, 5000);
      }
    },
    disconnect: (socket) => {
      log.info(`UISocket : [disconnect] - ${socket.id} disconnected.`);
    },
  })
}
