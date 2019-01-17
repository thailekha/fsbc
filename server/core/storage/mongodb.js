const mongoose = require('mongoose');
const User = require('./mongodbSchemas/User');
const DataAsset = require('./mongodbSchemas/DataAsset');
const Data = require('./mongodbSchemas/Data');

let isConnected;

const MongoDBController = {};

async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  const db = await mongoose.connect(`mongodb+srv://${process.env.ATLAS_CREDS}@coffeeproject-5irgt.mongodb.net/test?retryWrites=true`);
  isConnected = db.connections[0].readyState;
}

MongoDBController.postUser = async function(data) {
  await connectToDatabase();
  const response = await User.create(data);
  return response._id;
};

// MongoDBController.getUser = async function(id) {
//   await connectToDatabase();
//   await User.findById(id);
// };

MongoDBController.postDataAsset = async function(data) {
  await connectToDatabase();
  const response = await DataAsset.create(data);
  return response._id;
};

// MongoDBController.getDataAsset = async function(id) {
//   await connectToDatabase();
//   const response = await DataAsset.findById(id);
// };

MongoDBController.putDataAsset = async function(id, data) {
  await connectToDatabase();
  await DataAsset.update({guid: id}, data);
};

MongoDBController.postData = async function(data) {
  await connectToDatabase();
  const response = await Data.create(data);
  return response._id;
};

// MongoDBController.getData = async function(id) {
//   await connectToDatabase();
//   const response = await Data.findById(id);
// };

// async function testing() {
//   const id = await MongoDBController.postUser({
//     username: 'String',
//     hashedPassword: 'String',
//     salt: 'String',
//     role: 'String'
//   });
//   console.log(await MongoDBController.getUser(id));
// }
//
// async function testingDataAsset() {
//   const id = await MongoDBController.postDataAsset({
//     guid: 'String',
//     originalName: 'String',
//     mimetype: 'String',
//     lastChangedAt: 'String',
//     active: 1,
//     owner: 'String',
//     lastChangedBy: 'String',
//     authorizedUsers: ['String'],
//     lastVersion: 'String'
//   });
//   console.log(await MongoDBController.getDataAsset(id));
// }
//
// async function testingData() {
//   const id = await MongoDBController.postData({
//     guid: 'String',
//     data: 'String'
//   });
//   console.log(await MongoDBController.getData(id));
// }
//
// async function testingPutDataAsset() {
//   const response = await MongoDBController.putDataAsset('QmYbQ9iL4mZY9GZBs3Zn43WAFz3HgY4si7sA1J1bcyz4iP', {
//     guid: 'String',
//     originalName: 'String',
//     mimetype: 'String',
//     lastChangedAt: 'String',
//     active: 1,
//     owner: 'String',
//     lastChangedBy: 'String',
//     authorizedUsers: ['String'],
//     lastVersion: 'String'
//   });
//   console.log(response);
// }

if (process.env.NULL_DB) {
  MongoDBController.postUser = () => {};
  MongoDBController.postDataAsset = () => {};
  MongoDBController.putDataAsset = () => {};
  MongoDBController.postData = () => {};
}

module.exports = MongoDBController;