const mongoose = require('mongoose');
const DataAssetSchema = new mongoose.Schema({
  guid: String,
  originalName: String,
  mimetype: String,
  lastChangedAt: String,
  active: Boolean,
  owner: String,
  lastChangedBy: String,
  authorizedUsers: [String],
  lastVersion: String
});

module.exports = mongoose.model('DataAsset', DataAssetSchema);
