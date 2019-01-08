const blockchainController = require('../blockchain/controller');
const storageController = require('../storage/controller');

const FilesystemController = {};

FilesystemController.getAllData = async function(username) {
  const blockchainRecords = await blockchainController.getAllData(username);
  const allLatestDataAssets = [];
  for (const data of blockchainRecords) {
    const latestDataAsset = await blockchainController.getLatestData(data, username);
    if (latestDataAsset && allLatestDataAssets.findIndex(i => i.$identifier === latestDataAsset.$identifier) < 0) {
      allLatestDataAssets.push(latestDataAsset);
    }
  }
  allLatestDataAssets.sort((x,y) => x.lastChangedAt < y.lastChangedAt);
  // console.log(allLatestDataAssets.map(d => d.lastChangedAt));
  // debugger;
  const allLatestData = [];
  for (const guid of allLatestDataAssets.map(d => d.$identifier)) {
    const data = await storageController.getData(guid);
    allLatestData.push({ guid, data });
  }
  return allLatestData;
};

FilesystemController.getData = async function(guid, username) {
  const blockchainRecord = await blockchainController.getData(guid, username);
  await blockchainController.submitGetData(username, blockchainRecord.$identifier);
  const data = await storageController.getData(blockchainRecord.$identifier);
  return data;
};

FilesystemController.getLatestData = async function(guid, username) {
  // get data first to check authorization ?
  // await this.getData(guid, username);
  const blockchainRecord = await blockchainController.getData(guid, username);
  var latestGlobalUniqueID = (await blockchainController.getLatestData(blockchainRecord, username)).$identifier;
  if (!latestGlobalUniqueID) {
    //already latest
    latestGlobalUniqueID = guid;
  }

  const data = await storageController.getData(latestGlobalUniqueID);
  // await blockchainController.submitGetData(username, guid);
  return { latestGlobalUniqueID, data };
};

FilesystemController.postData = async function(username, data) {
  const guid = await storageController.postData(data);
  await blockchainController.postData(guid, username);
  await blockchainController.submitPostData(username, guid);
  return { globalUniqueID: guid};
};

FilesystemController.putData = async function(guid, username, data) {
  const blockchainRecord = await blockchainController.getData(guid, username);
  const newGuid = await storageController.postData(data);
  const newBlockchainRecord = await blockchainController.putData(blockchainRecord, newGuid, username);
  await blockchainController.submitPutData(username, blockchainRecord, newBlockchainRecord);
  return { globalUniqueID: newGuid};
};

FilesystemController.trace = async function(guid, username) {
  const allVersionRecords = await blockchainController.traceData(guid, username);
  const allVersions = [];
  for (const record of allVersionRecords) {
    const data = await storageController.getData(record.id);
    data.lastChangedAt = record.lastChangedAt;
    data.lastChangedBy = record.lastChangedBy;
    allVersions.push(data);
  }
  return allVersions;
};

FilesystemController.grantAccess = async function(guid, username, grantedUsers) {
  await blockchainController.grantAccess(guid, username, grantedUsers);
};

module.exports = FilesystemController;