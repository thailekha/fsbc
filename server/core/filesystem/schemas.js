const Joi = require('joi');

const FSSchemas = {};

FSSchemas.postData = Joi.any().required();

FSSchemas.putData = Joi.any().required();

FSSchemas.grantAccess = Joi.object().keys({
  grantedUsers: Joi.array().has(Joi.string().min(1)).required()
});

FSSchemas.revokeAccess = Joi.object().keys({
  userToBeRevoked: Joi.string().min(1).required()
});

module.exports = FSSchemas;
