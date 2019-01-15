const mongoose = require('mongoose');
const DataSchema = new mongoose.Schema({
  guid: String,
  data: String
});

module.exports = mongoose.model('Data', DataSchema);
