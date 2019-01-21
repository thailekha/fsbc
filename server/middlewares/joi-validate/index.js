const Joi = require('joi');
const statusCodes = require('http-status-codes');

module.exports = schema => async(req, res, next) => {
  const {error} = Joi.validate(req.body, schema);
  if (error) {
    return next({
      code: statusCodes.BAD_REQUEST,
      message: error.details.map(d => d.message).join('.')
    });
  }
  next(null);
};