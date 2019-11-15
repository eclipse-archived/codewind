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
const log4js = require('log4js');
const util = require('util');

const LoggingError = require('./errors/LoggingError');

const validLevels = ['error', 'warn', 'info', 'debug', 'trace'];
const loggingLevel = 'info'; // Should be 'info' for production code.
const contextName = 'context';
const config = {
  appenders: {
    'out': {
      type: 'stdout',
      layout: {
        type: 'pattern',
        pattern: `%[[%d{dd/MM/yy hh:mm:ss} %X{${contextName}}] [%p]%] %m`
      }
    }
  },
  categories: { default: { appenders: ['out'], level: loggingLevel } }
}

function setLoggingLevel(level) {
  if (!validLevels.includes(level)) throw new LoggingError('INVALID_LEVEL');
  config.categories.default.level = level;
  log4js.configure(config);
}

function allLoggingLevels() {
  return {
    currentLevel: config.categories.default.level,
    defaultLevel: loggingLevel,
    allLevels: validLevels,
  };
}


class Logger {
  constructor(context) {
    this.log = log4js.getLogger();
    log4js.configure(config);
    this.log.addContext(contextName, context);
  }

  trace(msg) { this.log.trace(msg); }

  debug(msg) { this.log.debug(msg); }

  info(msg) { this.log.info(msg); }

  warn(msg) { this.log.warn(msg); }

  error(msg) { this.log.error(msg); }

  logAllApiCalls(app) {
    app.use((req, res, next) => {
      this.logRequest(req);
      this.logResponse(req, res);
      next();
    });
  }

  logRequest(req) {
    const route = `${req.method} ${req.path}`;
    let isRegistrySecretRoute = false;
    const postRegistrySecretRoute = "POST /api/v1/registrysecrets";
    // We handle route POST /api/v1/registrysecrets as a special condition
    // because the API takes password in its body, so never log it on trace
    if(route === postRegistrySecretRoute) {
      isRegistrySecretRoute = true;
    }
    let msg = `${route} called`;
    if (!this.log.isTraceEnabled() || isRegistrySecretRoute) {
      this.log.debug(msg);
    } else {
      msg += ` with \n req.body ${util.inspect(req.body)}`;
      if (!isEmpty(req.query)) {
        msg += `, and \n req.query ${util.inspect(req.query)}`;
      }
      /*
       * we don't currently know how to log req.params automatically in Express middleware,
       * but you can log them manually in the .route file
       */
      this.log.trace(msg);
    }
  }

  logResponse(req, res) {
    res.on('finish', () => {
      const route = `${req.method} ${req.path}`;
      const reqBody = util.inspect(res.req.body);
      let isRegistrySecretRoute = false;
      const postRegistrySecretRoute = "POST /api/v1/registrysecrets";
      // We handle route POST /api/v1/registrysecrets as a special condition
      // because the API takes password in its body, so never log it on trace
      if(route === postRegistrySecretRoute) {
        isRegistrySecretRoute = true;
      }

      if (!isRegistrySecretRoute) {
        this.log.trace(`responded to ${route} with status ${res.statusCode} and body ${reqBody}`);
      } else {
        this.log.trace(`responded to ${route} with status ${res.statusCode}`);
      }
    });
  }
}

function isEmpty(obj) {
  return Object.entries(obj).length === 0 && obj.constructor === Object;
}

module.exports = Logger;
module.exports.setLoggingLevel = setLoggingLevel;
module.exports.allLoggingLevels = allLoggingLevels;
