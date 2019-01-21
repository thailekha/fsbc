const blockchainController = require('../blockchain/controller');
const storageController = require('../storage/controller');
const mongodb = require('../storage/mongodb');

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
  return { guid: latestGlobalUniqueID, data };
};

FilesystemController.postData = async function(username, data) {
  data._dateAdded = new Date();
  const guid = await storageController.postData(data);
  const dataAsset = await blockchainController.postData(guid, username);
  await blockchainController.submitPostData(username, guid);
  await mongodb.postData({
    guid: guid,
    data: JSON.stringify(data)
  });
  await mongodb.postDataAsset({
    guid: guid,
    originalName: dataAsset.originalName,
    mimetype: dataAsset.mimetype,
    lastChangedAt: dataAsset.lastChangedAt,
    active: 1,
    owner: dataAsset.owner,
    lastChangedBy: dataAsset.lastChangedBy,
    authorizedUsers: dataAsset.authorizedUsers,
    lastVersion: ''
  });
  return { globalUniqueID: guid};
};

FilesystemController.putData = async function(guid, username, data) {
  const blockchainRecord = await blockchainController.getData(guid, username);
  const newGuid = await storageController.postData(data);
  const newBlockchainRecord = await blockchainController.putData(blockchainRecord, newGuid, username);
  await blockchainController.submitPutData(username, blockchainRecord, newBlockchainRecord);
  await mongodb.postData({
    guid: newGuid,
    data: JSON.stringify(data)
  });
  await mongodb.postDataAsset({
    guid: newGuid,
    originalName: newBlockchainRecord.originalName,
    mimetype: newBlockchainRecord.mimetype,
    lastChangedAt: newBlockchainRecord.lastChangedAt,
    active: 1,
    owner: newBlockchainRecord.owner,
    lastChangedBy: newBlockchainRecord.lastChangedBy,
    authorizedUsers: newBlockchainRecord.authorizedUsers,
    lastVersion: newBlockchainRecord.lastVersion
  });
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
  const blockchainRecord = await blockchainController.getData(guid, username);
  await mongodb.putDataAsset(guid, {
    authorizedUsers: blockchainRecord.authorizedUsers,
  });
};

FilesystemController.revokeAccess = async function(guid, username, userToBeRevoked) {
  await blockchainController.revokeAccess(guid, username, userToBeRevoked);
  const blockchainRecord = await blockchainController.getData(guid, username);
  await mongodb.putDataAsset(guid, {
    authorizedUsers: blockchainRecord.authorizedUsers,
  });
};

FilesystemController.getAccessInfo = async function(guid, username) {
  const grantedUsers = await blockchainController.getAccessInfo(guid, username);
  return { grantedUsers };
};

module.exports = FilesystemController;
