const Logger = require('../modules/utils/Logger');

const log = new Logger(__filename);

function handleErrors(err, req, res, _next) {
  logError(err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).send(err.message);
}

function logError(err) {
  log.error({
    error: {
      name: err.name,
      message: err.message,
    },
  });
}

module.exports = {
  handleErrors,
};
