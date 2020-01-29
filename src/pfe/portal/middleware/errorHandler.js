const Logger = require('../modules/utils/Logger');

const log = new Logger(__filename);

function handleErrors(err, req, res, _next) {
  log.error(generateLogMsg(err));
  const statusCode = err.statusCode || 500;
  res.status(statusCode).send(err.message);
}

function generateLogMsg(err) {
  const errorsToLogSuccintly = ['ValidationError'];
  if (errorsToLogSuccintly.includes(err.name)) {
    return `${err.name}: ${err.message}`;
  } 
  return err;
}

module.exports = {
  handleErrors,
};
