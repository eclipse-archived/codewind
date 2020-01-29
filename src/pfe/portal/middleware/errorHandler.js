const Logger = require('../modules/utils/Logger');

const log = new Logger(__filename);

function handleErrors(err, req, res, _next) {
  log.error(err.customLogMsg || err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).send(err.message);
}

module.exports = {
  handleErrors,
};
