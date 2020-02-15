const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const DataSchema = new mongoose.Schema({
  guid: { type: String, index: true, unique: true, required: true },
  data: { type: String, required: true }
});

DataSchema.plugin(uniqueValidator);

module.exports = mongoose.model('Data', DataSchema);