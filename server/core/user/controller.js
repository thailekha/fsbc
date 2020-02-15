const crypto = require('crypto');
const jwt = require('jsonwebtoken');
// const blockchainController = require('../blockchain/controller');
const MongoDBController = require('../data/mongodb/mongodb');
const statusCodes = require('http-status-codes');
const utils = require('../utils');

const mongodb = new MongoDBController(process.env.ATLAS_CREDS);
const fsController = require('../filesystem/controller')(mongodb);

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
  const hashedPassword = sha512(password, salt);

  // await blockchainController.registerParticipant(username, role, salt, hashedPassword);

  if (role === 'INSTRUCTOR' && (await mongodb.hasInstructor()).length > 0) {
    throw utils.constructError(`Instructor already registered`, statusCodes.CONFLICT);
  }

  try {
    await mongodb.postUser({username,hashedPassword,salt,role});
    if (role !== 'INSTRUCTOR') {
      await fsController.populatePublishedDataToNewUser(username);
    }
  } catch (err) {
    // notice if populatePublishedDataToNewUser is used, this error could mean duplicate data asset as well
    throw utils.formatError(err.message, 'to be unique', 'Email already registered', statusCodes.CONFLICT, 'Cannot register');
  }
};

UserController.login = async function(username, password) {
  username = username.toLowerCase();

  // const claimedUser = await blockchainController.queryGetUser(username);
  // if (sha512(password, claimedUser.salt) !== claimedUser.hashedPassword) {
  //   throw utils.constructError('Password is incorrect', statusCodes.BAD_REQUEST);
  // }
  // return jwt.sign({ username: claimedUser.$identifier }, 'secret', { expiresIn: '5h' });

  const claimedUser = await mongodb.getUser(username);
  if (!claimedUser) {
    throw utils.constructError('Email is incorrect', statusCodes.BAD_REQUEST);
  }
  if (sha512(password, claimedUser.salt) !== claimedUser.hashedPassword) {
    throw utils.constructError('Password is incorrect', statusCodes.BAD_REQUEST);
  }
  claimedUser.logins.push((new Date()).getTime());
  await mongodb.addOrUpdateParticipant(claimedUser);
  return {
    token: jwt.sign({ username: claimedUser.username }, 'secret', { expiresIn: '5h' }),
    role: claimedUser.role
  };
};

module.exports = UserController;