const Joi = require('joi');

const UserSchemas = {};

UserSchemas.register = Joi.object().keys({
  username: Joi.string().email({ minDomainAtoms: 2 }).regex(/@usask\.ca$/).required().error(es =>
    es.map(e => (e.type === "string.regex.base" ? (e.message = "Please use usask email i.e. @usask.ca", e) : e))),
  password: Joi.string().alphanum().min(3).max(30).required(),
  role: Joi.string().min(3).max(30).required()
});

UserSchemas.login = Joi.object().keys({
  username: Joi.string().email({ minDomainAtoms: 2 }).regex(/@usask\.ca$/).required().error(es =>
    es.map(e => (e.type === "string.regex.base" ? (e.message = "Please use usask email i.e. @usask.ca", e) : e))),
  password: Joi.string().alphanum().min(3).max(30).required()
});

module.exports = UserSchemas;