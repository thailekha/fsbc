const mongoose = require('mongoose');
const User = require('./schemas/user');
const DataAsset = require('./schemas/dataAsset');
const Data = require('./schemas/data');
const utils = require('../../utils');

const validDataAssetAccess = username => [
  {
    owner: {
      $eq: username
    }
  },
  {
    authorizedUsers: {
      $in: [
        username
      ]
    }
  }
];

class MongoDBController {
  // Need to pass creds for collector endpoint
  constructor(creds) {
    if (!creds) {
      throw new Error('Invalid DB creds');
    }

    this.uri = `${creds}?retryWrites=true&w=majority`;
    this.isConnected = null;
  }

  async connectToDatabase() {
    if (this.isConnected) {
      return;
    }
    const db = await mongoose.connect(this.uri, { useNewUrlParser: true, useFindAndModify: false, useCreateIndex: true, useUnifiedTopology: true });
    this.isConnected = db.connections[0].readyState;
  }

  // ############################
  // For testing
  // ############################

  async deleteDocuments() {
    await this.connectToDatabase();
    if (mongoose.connection.host === '127.0.0.1') {
      utils.logger.warn(`<DELETE-DOCUMENTS>`);
      await User.deleteMany({});
      await DataAsset.deleteMany({});
      await Data.deleteMany({});
      return;
    }
    utils.logger.warn(`<DELETE-DOCUMENTS> did NOT run`);
  }

  // ############################
  // User
  // ############################

  async postUser(data) {
    await this.connectToDatabase();
    await User.create(data);
  }

  async addOrUpdateParticipant(data) {
    await this.connectToDatabase();
    const {username} = data;
    await User.findOneAndUpdate({username}, data, {upsert: true});
  }

  async getUser(username) {
    await this.connectToDatabase();
    return await User.findOne({username});
  }

  async getUsers() {
    await this.connectToDatabase();
    return await User.find();
  }

  async hasInstructor() {
    await this.connectToDatabase();
    return await User.find({role: 'INSTRUCTOR'});
  }

  // ############################
  // Data asset
  // (Update using get and save instead of findOneAndUpdate)
  // ############################

  /**
   * @param data: both object and array are supported by  mongoose
   */
  async postDataAsset(data) {
    await this.connectToDatabase();
    await DataAsset.create(data);
  }

  async getDataAsset(guid) {
    await this.connectToDatabase();
    const res = await DataAsset.findOne({guid});
    return res;
  }

  async getDataAssetByFirstVersion(firstVersion, username) {
    await this.connectToDatabase();
    const res = await DataAsset.find({
      firstVersion,
      $or: validDataAssetAccess(username)
    }).lean();
    return res;
  }

  // async putDataAsset(guid, data) {
  //   await this.connectToDatabase();
  //   const res = await DataAsset.findOne({guid});
  //   for (const [key, value] of Object.entries(data)) {
  //     res[key] = value;
  //   }
  //   await res.save();
  // };

  async getAllDataAssets() {
    await this.connectToDatabase();
    const res = await DataAsset.find().lean();
    return res;
  }

  async getAllDataAssetsOfUser(username) {
    await this.connectToDatabase();
    const res = await DataAsset.find({
      $or: validDataAssetAccess(username)
    }).lean();
    return res;
  }

  async getDataAssetsWhereGuidEqSourceOfPublish() {
    await this.connectToDatabase();
    // Please do not use es6 syntax in $where, mongo's JS interpreter cannot process it
    // Registering more than 100 students (more data asset) and this got slow
    // const res = await DataAsset.find({
    //   $where: function() {
    //     return this.guid === this.sourceOfPublish;
    //   }
    // }).lean();

    // https://docs.mongodb.com/manual/reference/operator/query/expr/

    const res = await DataAsset.find({
      $expr: {
        $eq: [ "$guid" , "$sourceOfPublish" ]
      }
    }).lean();
    return res;
  }

  async getNewerVersionOfDataAsset(lastVersion) {
    await this.connectToDatabase();
    const res = await DataAsset.findOne({lastVersion}).lean();
    return res;
  }

  // ############################
  // Data
  // ############################

  /**
   * @param data: both object and array are supported by  mongoose
   */
  async postData(data) {
    await this.connectToDatabase();
    await Data.create(data);
  }

  async getData(guid) {
    await this.connectToDatabase();
    return await Data.findOne({guid}).lean();
  }

  async getDatas(guids) {
    await this.connectToDatabase();
    const res = await Data.find({
      'guid': { $in: guids}
    }).lean();
    return res;
  }
}

module.exports = MongoDBController;