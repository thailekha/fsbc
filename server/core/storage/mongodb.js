const mongoose = require('mongoose');
const User = require('./mongodbSchemas/user');
const DataAsset = require('./mongodbSchemas/dataAsset');
const Data = require('./mongodbSchemas/data');

// if (!process.env.BACKUP_PATH) {
//   throw new Error('BACKUP_PATH not set');
// }

// const BACKUP_QUEUE_PATH = process.env.BACKUP_PATH;

let isConnected;

const MongoDBController = {};

async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  const db = await mongoose.connect(`mongodb+srv://${process.env.ATLAS_CREDS}@coffeeproject-5irgt.mongodb.net/test?retryWrites=true`, { useNewUrlParser: true });
  isConnected = db.connections[0].readyState;
}

MongoDBController.postUser = async function(data) {
  await connectToDatabase();
  await User.create(data);
};

MongoDBController.addOrUpdateParticipant = async function(data) {
  await connectToDatabase();
  const {username} = data;
  await User.findOneAndUpdate({username}, data, {upsert: true});
};

// MongoDBController.getUser = async function(id) {
//   await connectToDatabase();
//   await User.findById(id);
// };

MongoDBController.postDataAsset = async function(data) {
  await connectToDatabase();
  await DataAsset.create(data);
};

MongoDBController.addOrUpdateDataAsset = async function(data) {
  await connectToDatabase();
  const {guid} = data;
  await DataAsset.findOneAndUpdate({guid}, data, {upsert: true});
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
  await Data.create(data);
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

module.exports = MongoDBController;