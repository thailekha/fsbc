const mongoose = require('mongoose');
const User = require('./mongodbSchemas/user');
const DataAsset = require('./mongodbSchemas/dataAsset');
const Data = require('./mongodbSchemas/data');

let isConnected;

const MongoDBController = {};

async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  const db = await mongoose.connect(`mongodb+srv://${process.env.ATLAS_CREDS}?retryWrites=true`, { useNewUrlParser: true, useFindAndModify: false, useCreateIndex: true });
  // const db = await mongoose.connect(`mongodb://127.0.0.1:27017/test`, { useNewUrlParser: true, useFindAndModify: false, useCreateIndex: true });
  isConnected = db.connections[0].readyState;
}

// ############################
// User
// ############################

MongoDBController.postUser = async function(data) {
  await connectToDatabase();
  await User.create(data);
};

MongoDBController.addOrUpdateParticipant = async function(data) {
  await connectToDatabase();
  const {username} = data;
  await User.findOneAndUpdate({username}, data, {upsert: true});
};

MongoDBController.getUser = async function(username) {
  await connectToDatabase();
  return await User.findOne({username});
};

MongoDBController.getUsers = async function() {
  await connectToDatabase();
  return await User.find();
};

// ############################
// Data asset
// (Update using get and save instead of findOneAndUpdate)
// ############################

/**
 * @param data: both object and array are supported by  mongoose
 */
MongoDBController.postDataAsset = async function(data) {
  await connectToDatabase();
  await DataAsset.create(data);
};

MongoDBController.getDataAsset = async function(guid) {
  await connectToDatabase();
  const res = await DataAsset.findOne({guid});
  return res;
};

MongoDBController.getDataAssetByFirstVersion = async function(firstVersion) {
  await connectToDatabase();
  const res = await DataAsset.find({firstVersion}).lean();
  return res;
};

// MongoDBController.putDataAsset = async function(guid, data) {
//   await connectToDatabase();
//   const res = await DataAsset.findOne({guid});
//   for (const [key, value] of Object.entries(data)) {
//     res[key] = value;
//   }
//   await res.save();
// };

MongoDBController.getAllDataAssets = async function() {
  await connectToDatabase();
  const res = await DataAsset.find().lean();
  return res;
};

MongoDBController.getNewerVersionOfDataAsset = async function(lastVersion) {
  await connectToDatabase();
  const res = await DataAsset.findOne({lastVersion}).lean();
  return res;
};

// ############################
// Data
// ############################

/**
 * @param data: both object and array are supported by  mongoose
 */
MongoDBController.postData = async function(data) {
  await connectToDatabase();
  await Data.create(data);
};

MongoDBController.getData = async function(guid) {
  await connectToDatabase();
  return await Data.findOne({guid}).lean();
};

MongoDBController.getDatas = async function(guids) {
  await connectToDatabase();
  const res = await Data.find({
    'guid': { $in: guids}
  }).lean();
  return res;
};

module.exports = MongoDBController;