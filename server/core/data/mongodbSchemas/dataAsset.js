const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const DataAssetSchema = new mongoose.Schema({
  guid: { type: String, index: true, unique: true, required: true },
  originalName: String,
  mimetype: String,
  lastChangedAt: String,
  active: Boolean,
  owner: String,
  lastChangedBy: String,
  authorizedUsers: [String],
  lastVersion: String,
  firstVersion: { type: String, required: true },
  sourceOfPublish: { type: String, required: true }
});

DataAssetSchema.plugin(uniqueValidator);

module.exports = mongoose.model('DataAsset', DataAssetSchema);