// const ipfs = require('./ipfs');
const mongodb = require('./mongodb');

function constructController(storageMedium) {
  const StorageController = {};
  StorageController.getData = storageMedium.getData;
  StorageController.postData = storageMedium.postData;

  return StorageController;
}

module.exports = constructController(mongodb);