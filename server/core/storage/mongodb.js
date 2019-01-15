const mongoose = require('mongoose');
const User = require('./mongodbSchemas/User');
const DataAsset = require('./mongodbSchemas/DataAsset');
const Data = require('./mongodbSchemas/Data');

let isConnected;

async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  console.log('=> Using new database connection');
  const db = await mongoose.connect(`mongodb+srv://${process.env.ATLAS_CREDS}@coffeeproject-5irgt.mongodb.net/test?retryWrites=true`);
  console.log('dbbbb', db);
  isConnected = db.connections[0].readyState;
  return db;
}

const MongoDBController = {};

MongoDBController.postUser = async function(data) {
  await connectToDatabase();
  const response = await User.create(data);
  //await connection.disconnect();
  return response._id;
};

// MongoDBController.getUser = async function(id) {
//   await connectToDatabase();
//   await User.findById(id);
//   //await connection.disconnect();
// };

MongoDBController.postDataAsset = async function(data) {
  await connectToDatabase();
  const response = await DataAsset.create(data);
  //await connection.disconnect();
  return response._id;
};

// MongoDBController.getDataAsset = async function(id) {
//   await connectToDatabase();
//   const response = await DataAsset.findById(id);
//   //await connection.disconnect();
// };

MongoDBController.putDataAsset = async function(id, data) {
  await connectToDatabase();
  await DataAsset.update({guid: id}, data);
  //await connection.disconnect();
};

MongoDBController.postData = async function(data) {
  await connectToDatabase();
  const response = await Data.create(data);
  //await connection.disconnect();
  return response._id;
};

// MongoDBController.getData = async function(id) {
//   await connectToDatabase();
//   const response = await Data.findById(id);
//   //await connection.disconnect();
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

module.exports = MongoDBController;
