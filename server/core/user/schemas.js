const Joi = require('joi');

const UserSchemas = {};

UserSchemas.register = Joi.object().keys({
  username: Joi.string().email({ minDomainAtoms: 2 }).required(),
  password: Joi.string().alphanum().min(3).max(30).required(),
  role: Joi.string().min(3).max(30).required()
});

UserSchemas.login = Joi.object().keys({
  username: Joi.string().email({ minDomainAtoms: 2 }).required(),
  password: Joi.string().alphanum().min(3).max(30).required()
});

module.exports = UserSchemas;