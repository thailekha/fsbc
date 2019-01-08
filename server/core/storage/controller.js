const ipfs = require('./ipfs');

const StorageController = {};
StorageController.getData = ipfs.getData;
StorageController.postData = ipfs.postData;

module.exports = StorageController;