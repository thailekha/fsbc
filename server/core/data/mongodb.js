const mongoose = require('mongoose');
const User = require('./mongodbSchemas/user');
const DataAsset = require('./mongodbSchemas/dataAsset');
const Data = require('./mongodbSchemas/data');
const utils = require('../utils');

class MongoDBController {
  constructor(creds) {
    this.uri = creds && !creds.includes('127.0.0.1') ?
      `mongodb+srv://${creds}?retryWrites=true` : 'mongodb://127.0.0.1:27017/test';
    this.isConnected = null;
  }

  async connectToDatabase() {
    if (this.isConnected) {
      return;
    }
    const db = await mongoose.connect(this.uri, { useNewUrlParser: true, useFindAndModify: false, useCreateIndex: true });
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

  async getDataAssetByFirstVersion(firstVersion) {
    await this.connectToDatabase();
    const res = await DataAsset.find({firstVersion}).lean();
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