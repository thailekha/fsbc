const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  username: String,
  hashedPassword: String,
  salt: String,
  role: String
});

module.exports = mongoose.model('User', UserSchema);
