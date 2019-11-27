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
    // We are removing credentials from req body because
    // POST /api/v1/registrysecrets takes credentials in its body
    // and we do not want to log this information to the PFE log
    const {credentials, ...reqBodyWithoutCredentials} = req.body;
    let msg = `${route} called`;
    if (!this.log.isTraceEnabled()) {
      this.log.debug(msg);
    } else {
      msg += ` with \n req.body ${util.inspect(reqBodyWithoutCredentials)}`;
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
      // We are removing credentials from req body because
      // POST /api/v1/registrysecrets takes credentials in its body
      // and we do not want to log this information to the PFE log
      const {credentials, ...reqBodyWithoutCredentials} = res.req.body;
      const reqBody = util.inspect(reqBodyWithoutCredentials);

      this.log.trace(`responded to ${route} with status ${res.statusCode} and body ${reqBody}`);
    });
  }
}

function isEmpty(obj) {
  return Object.entries(obj).length === 0 && obj.constructor === Object;
}

module.exports = Logger;
module.exports.setLoggingLevel = setLoggingLevel;
module.exports.allLoggingLevels = allLoggingLevels;
