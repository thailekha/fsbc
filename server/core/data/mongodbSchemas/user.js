const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const UserSchema = new mongoose.Schema({
  username: { type: String, index: true, unique: true, required: true },
  hashedPassword: String,
  salt: String,
  role: String,
  logins: [Number]
});

UserSchema.plugin(uniqueValidator);

module.exports = mongoose.model('User', UserSchema);