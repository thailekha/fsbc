const statusCodes = require('http-status-codes');

module.exports = (err, req, res, next) => {
  if (err instanceof Error) {
    var error = {};

    Object.getOwnPropertyNames(err).forEach(function(key) {
      if (key !== 'stack') {
        error[key] = err[key];
      }
    });

    return res.status(err.code && (err.code >= 100 && err.code < 600) ? err.code : statusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
  return res.status(err.code && (err.code >= 100 && err.code < 600) ? err.code : statusCodes.INTERNAL_SERVER_ERROR).json(err);
};