const Joi = require('joi');

module.exports = schema => async(req, res, next) => {
  const {error} = Joi.validate(req.body, schema);
  if (error) {
    return next(error);
  }
  next(null);
};