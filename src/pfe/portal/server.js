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

// Because main is async it can swallow exceptions (like syntax errors in
// required files unless we handle them.
main().catch(err => console.dir(err));

// Wrap everything in an async function so we can use
// await to serialize initialisation.
async function main() {

  // Set the umask for file creation.
  process.umask(0o002);

  if (process.env.APPMETRICS) { // dev mode
    require('appmetrics-dash').monitor({ title: "Application Metrics Dashboard - Monitoring codewind Portal" });
  }
  const express = require('express');
  const request = require('request');
  const { promisify } = require('util');
  const Logger = require('./modules/utils/Logger');
  const WebSocket = require('./modules/WebSocket');
  const log = new Logger('server.js');
  const app = express();
  const serverPort = (process.env.PORTAL_HTTPS == 'true') ? 9191 : 9090;
  let server;

  if (process.env.PORTAL_HTTPS == 'true') {
    const pem = require('pem');
    const createCertificateAsync = promisify(pem.createCertificate);
    let keys = await createCertificateAsync({ selfSigned: true });
    const https = require('https');
    server = https.createServer({ key: keys.serviceKey, cert: keys.certificate }, app).listen(serverPort);
  } else {
    const http = require('http');
    server = http.createServer(app).listen(serverPort);
  }
  WebSocket.createWebsocketServer(server);
  // Add basic protection against XSS and CSRF.
  // This is not foolproof just a sanity check.
  // https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.md
  // This needs to happen before we add authentication or any
  // other routes.
  function isRequestAllowed(req) {
    // The target origin is the host in the header, but if proxied we should
    // prefer the x-forwarded-host header field.
    let targetOrigin = req.headers['x-forwarded-host'] || req.headers['host'];
    // The origin may be in the header field but if that is missing use the
    // referer field.
    let origin = req.headers['origin'] || req.headers['referer'];

    let originURL = new URL(origin);

    log.trace(`Checking origin host ${originURL.host} matches expected host ${targetOrigin}`);

    if (origin && targetOrigin) {
      if (originURL.host === targetOrigin) {
        // Origin and target match so this request is Ok.
        return true;
      }
      log.error(`portal/server.js: Origin host ${originURL.host} does not match expected host ${targetOrigin}`);
      return false;
    }
    // No origin or targetOrigin, can't check.
    return true;
  }

  function addSanitize(req) {
    // Only sanitize strings, bodyParser will have parsed JSON
    // and created numbers and booleans which should be safe.
    function santizeStrings(arg) {
      if (typeof arg === 'string') {
        return sanitizer.sanitize(arg);
      }
      return arg;
    }

    // Add sanitising getter for body params here.
    req.sanitizeBody = (name) => santizeStrings(req.body[name]); // eslint-disable-line microclimate-portal-eslint/sanitise-body-parameters
    req.sanitizeParams = (name) => santizeStrings(req.params[name]); // eslint-disable-line microclimate-portal-eslint/sanitise-body-parameters

    return req;
  }

  function securityMiddleware(req, res, next) {
    req = addSanitize(req); // eslint-disable-line no-param-reassign

    // disable iframe usage from other origins
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('Content-Security-Policy', "frame-ancestors 'self';");

    // Only block requests that change state like PUT, POST, DELETE
    if (req.method == "GET") {
      return next();
    }

    if (!isRequestAllowed(req)) {
      res.status(403).end();
    }

    return next();
  }

  const bodyParser = require('body-parser');
  const sanitizer = require('sanitizer');
  const URL = require('url-parse');

  // Kubernetes-client v5
  const K8Client = require('kubernetes-client').Client
  const k8config = require('kubernetes-client').config;
  let k8Client = null

  // Make the JSON output from REST APIs human readable.
  app.set('json spaces', 2);

  // Setup global variables
  global.codewind = {
    RUNNING_IN_K8S: false,
    MULTI_USER: (process.env.MULTI_USER == 'true') || false,
    EXTENSIONS: (process.env.EXTENSIONS == 'true') || false,
    // Workspace location *inside* the our container.
    // Volume is mounted from WORKSPACE_DIRECTORY in docker-compose.yaml.
    CODEWIND_WORKSPACE: '/codewind-workspace/',
    REMOTE_MODE: (process.env.REMOTE_MODE == 'true') || false,
  };

  // find if running in kubernetes and build up a whitelist of allowed origins
  const originsWhitelist = []
  try {
    k8Client = new K8Client({ config: k8config.getInCluster(), version: '1.9' });
    if (k8Client) {
      log.info('starting codewind on Kubernetes');
      global.codewind.RUNNING_IN_K8S = true;

      // get current ingress path - it is passed in an env var
      // https://github.com/eclipse/codewind-che-plugin/blob/master/codewind-che-sidecar/scripts/kube/codewind_template.yaml#L135
      const INGRESS_HOST_ENVVAR = 'CHE_INGRESS_HOST';
      const k8sIngressPath = process.env[INGRESS_HOST_ENVVAR];
      log.info(`Ingress path is "${k8sIngressPath}"`);
      if (!k8sIngressPath) {
        throw new Error(`${INGRESS_HOST_ENVVAR} was not set in the environment`);
      }
      const protocol = process.env.PORTAL_HTTPS == 'true' ? 'https://' : 'http://'
      originsWhitelist.push(protocol + k8sIngressPath);
    }
  } catch (err) {
    log.error(`Error initializing codewind on Kubernetes: ${JSON.stringify(err)}`);
  }

  if (!global.codewind.RUNNING_IN_K8S) {
    originsWhitelist.push('http://localhost:*');
  }

  const io = require('socket.io').listen(server, {
    cookie: false,
    origins: originsWhitelist,
    allowRequest: (req, callback) => {
      try {
        const allowed = isRequestAllowed(req);
        const errCode = allowed ? null : 'REQUEST_DENIED';
        callback(errCode, allowed);
      } catch (error) {
        callback(error, false);
      }
    }
  });

  const routes = require('./routes');
  const { handleErrors } = require('./middleware/errorHandler');
  // Classes
  const UserList = require('./modules/UserList.js');
  const User = require('./modules/User.js');

  let userList = new UserList();

  app.get('/', (req, res) => { res.sendStatus(200); });
  app.get('/health', (req, res) => { res.sendStatus(200); });
  app.use(securityMiddleware);

  // Default, single user implementation
  let user = await User.createUser(
    null,
    null,
    global.codewind.CODEWIND_WORKSPACE,
    io
  );
  userList.add(user);
  setRoutes();

  /**
   * Function to set up express routes for codewind portal. All external APIs
   * should be defined inside this function, so that any authentication routes can
   * be set up first, before this function is run.
   */
  function setRoutes() {

    // if we are running in Che use the workspace codewind performance service,  else use the codewind container name of "codewind-performance"
    const performance_host = process.env.CODEWIND_PERFORMANCE_SERVICE ? process.env.CODEWIND_PERFORMANCE_SERVICE : "codewind-performance";
    const performance_port = ':9095';

    log.info(`PerformanceHost: ${performance_host}`);

    // Add the user object into the request
    app.all('*', function (req, res, next) {
      if (req.user == undefined) req.user = "default"
      req.cw_user = userList.retrieve(req.user);
      next();
    });

    const webpages = __dirname + '/client/dist';
    const css = __dirname + '/client/dist/css';
    const images = __dirname + '/client/dist/img';
    const fonts = __dirname + '/client/dist/fonts';
    const scripts = __dirname + '/client/dist/js';
    const bash = __dirname + '/bash';

    log.info('Setting up codewind Express routes');
    app.use('/', express.static(webpages, {
      extensions: ['html', 'png']
    }));
    app.use('/css', express.static(css, {
      extensions: ['css']
    }));
    app.use('/img', express.static(images, {
      extensions: ['png', 'jpg', 'svg']
    }));
    app.use('/js', express.static(scripts, {
      extensions: ['js', 'gz']
    }));
    app.use('/fonts', express.static(fonts, {
      extensions: ['eot', 'woff', 'woff2']
    }));
    app.use('/', express.static(bash, {
      extensions: ['sh']
    }));

    /* Proxy Performance container routes */
    app.use('/performance/*', function (req, res) {
      try {
        log.info(`req.originalUrl = ${req.originalUrl}`);
        let url = `http://${performance_host}${performance_port}${req.originalUrl}`;
        log.info(`url = ${url}`);

        let r = request(url);
        req.pipe(r).on('error', function(err) {
          log.error(err);
          res.status(502).send({ error: err.code});
        }).pipe(res);
      } catch (err) {
        log.error(err);
      }
    });

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
      extended: false
    }));

    log.logAllApiCalls(app); // must be called after 'app.use(bodyParser)', and before 'app.use(router)'

    app.use(routes);

    // Default route to send a 404 response, rather than the express default which
    // sends back the user input, and was seen as a content spoofing vulnerability
    app.use(function (req, res) {
      res.sendStatus(404);
    });

    app.use(handleErrors);
  }

}
