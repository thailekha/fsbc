const Joi = require('joi');

const UserSchemas = {};

UserSchemas.register = Joi.object().keys({
  username: Joi.string().email({ minDomainAtoms: 2 }).required(),
  password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required(),
  role: Joi.string().required()
});

UserSchemas.login = Joi.object().keys({
  username: Joi.string().email({ minDomainAtoms: 2 }).required(),
  password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required()
});

module.exports = UserSchemas;