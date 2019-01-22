const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const blockchainController = require('../blockchain/controller');
const mongodb = require('../storage/mongodb');
const statusCodes = require('http-status-codes');
const utils = require('../utils');

const UserController = {};

function genRandomString(length) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex') /** convert to hexadecimal format */
    .slice(0, length); /** return required number of characters */
}

function sha512(password, salt) {
  const hash = crypto.createHmac('sha512', salt); /** Hashing algorithm sha512 */
  hash.update(password);
  return hash.digest('hex');
}

UserController.register = async function(username, password, role) {
  username = username.toLowerCase();
  const salt = genRandomString(16);
  await blockchainController.registerParticipant(username, role, salt, sha512(password, salt));
  await mongodb.postUser({
    username: username,
    hashedPassword: sha512(password, salt),
    salt: salt,
    role: role
  });
};

UserController.login = async function(username, password) {
  username = username.toLowerCase();
  const claimedUser = await blockchainController.queryGetUser(username);
  if (sha512(password, claimedUser.salt) !== claimedUser.hashedPassword) {
    throw utils.constructError('Password is incorrect', statusCodes.BAD_REQUEST);
  }
  return jwt.sign({ username: claimedUser.$identifier }, 'secret', { expiresIn: '5h' });
};

module.exports = UserController;