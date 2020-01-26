// // const ipfs = require('./ipfs');
// const MongoDBController = require('./mongodb');

// function constructController(storageMedium) {
//   const StorageController = {};
//   StorageController.getData = storageMedium.getData;
//   StorageController.postData = storageMedium.postData;

//   return StorageController;
// }

// module.exports = constructController(new MongoDBController(process.env.ATLAS_CREDS));