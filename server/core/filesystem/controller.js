const crypto = require('crypto');
const hash = require('object-hash');
const statusCodes = require('http-status-codes');
const utils = require('../utils');

let mongodb;
const FilesystemController = {};
module.exports = db => (mongodb = db, FilesystemController);

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function constructVersion(asset) {
  const result = {
    id: asset.guid,
    lastChangedAt: asset.lastChangedAt,
    lastChangedBy: asset.lastChangedBy
  };

  return JSON.parse(JSON.stringify(result));
}

// ############################
// Encryption
// ############################

if (!process.env.DATAENCRYPT_SECRET) {
  throw new Error('DATAENCRYPT_SECRET not set');
}

const ALGORITHM = 'aes-256-cbc';
const PASSWORD = process.env.DATAENCRYPT_SECRET;

const needJsonStringify = data => !(data instanceof Buffer) && (data instanceof Object);

function encrypt(data) {
  const cipher = crypto.createCipher(ALGORITHM,PASSWORD);
  const crypted = cipher.update(needJsonStringify(data) ? JSON.stringify(data) : data,'utf8','hex') + cipher.final('hex');
  return crypted;
}

function decrypt(encrypted) {
  const decipher = crypto.createDecipher(ALGORITHM,PASSWORD);
  const decrypted = decipher.update(encrypted,'hex','utf8') + decipher.final('utf8');
  try {
    return JSON.parse(decrypted);
  } catch (e) {
    if (!(e instanceof SyntaxError)) {
      throw e;
    }
  }
  return decrypted;
}

// ############################
// Validator
// ############################

const validAccess = (dataAsset, username) => dataAsset.owner === username || dataAsset.authorizedUsers.includes(username);

function validateAccessDataAsset(data, dataAsset, username) {
  //check user exists
  if (!data) {
    throw utils.constructError(`Cannot find data`, statusCodes.NOT_FOUND);
  }
  if (!dataAsset) {
    throw utils.constructError(`Cannot find data asset`, statusCodes.NOT_FOUND);
  }
  if (!validAccess(dataAsset, username)) {
    throw utils.constructError(`Unauthorized user`, statusCodes.FORBIDDEN);
  }
}

function dataAssetExists(dataAsset) {
  if (!dataAsset) {
    throw utils.constructError(`Cannot find data asset`, statusCodes.NOT_FOUND);
  }
}

// ############################
// Basic CRUD
// ############################

FilesystemController.postData = async function(username, data) {
  data._dateAdded = (new Date()).getTime();
  const encryptedData = encrypt(data);

  const guid = hash(encryptedData);

  await mongodb.postData({
    guid: guid,
    data: encryptedData
  });

  await mongodb.postDataAsset({
    guid: guid,
    originalName: '',
    mimetype: 'application/json',
    lastChangedAt: (new Date()).getTime(),
    active: 1,
    owner: username,
    lastChangedBy: username,
    authorizedUsers: [],
    lastVersion: null,
    firstVersion: guid,
    sourceOfPublish: null
  });
  return { globalUniqueID: guid };
};

FilesystemController.getData = async function(guid, username) {
  const dataAsset = await mongodb.getDataAsset(guid);
  const data = await mongodb.getData(guid);
  validateAccessDataAsset(data, dataAsset, username);
  return decrypt(data.data);
};

FilesystemController.putData = async function(guid, username, data) {
  const dataAsset = await mongodb.getDataAsset(guid);
  const oldData = await mongodb.getData(guid);
  validateAccessDataAsset(oldData, dataAsset, username);

  data._dateAdded = (new Date()).getTime();
  const encryptedData = encrypt(data);
  const newGuid = hash(encryptedData);

  await mongodb.postData({
    guid: newGuid,
    data: encryptedData
  });

  await mongodb.postDataAsset({
    guid: newGuid,
    originalName: dataAsset.originalName,
    mimetype: dataAsset.mimetype,
    lastChangedAt: (new Date()).getTime(),
    active: 1,
    owner: dataAsset.owner,
    lastChangedBy: username,
    authorizedUsers: dataAsset.authorizedUsers,
    lastVersion: guid,
    firstVersion: dataAsset.firstVersion,
    sourceOfPublish: dataAsset.sourceOfPublish
  });

  return { globalUniqueID: newGuid };
};

// ############################
// Advanced
// ############################

FilesystemController.organizeToLatestAssets = function(username, assets) {
  var latestAssets = {};
  assets
    .filter(a => {
      if (username) {
        return a.owner === username || a.authorizedUsers.includes(username);
      }
      return true;
    })
    .forEach(a => {
      if (!latestAssets[a.firstVersion] || latestAssets[a.firstVersion].lastChangedAt < a.lastChangedAt) {
        latestAssets[a.firstVersion] = a;
      }
    });
  latestAssets = Object
    .values(latestAssets)
    .filter(a => {
      if (username) {
        return validAccess(a, username);
      }
      return true;
    });
  // change lastChangedAt schema to int?
  latestAssets.sort((x,y) => x.lastChangedAt < y.lastChangedAt);
  const dates = {};
  latestAssets.forEach(a => dates[a.guid] = a.lastChangedAt);

  if (latestAssets.length !== Object.entries(dates).length) {
    throw utils.constructError(`Failed to process latest data assets`, statusCodes.INTERNAL_SERVER_ERROR);
  }
  return {latestAssets, dates};
};

FilesystemController.getAllData = async function(username) {
  const {latestAssets, dates} = this.organizeToLatestAssets(username, await mongodb.getAllDataAssets());
  const lastestDatas = await mongodb.getDatas(latestAssets.map(d => d.guid));
  lastestDatas.sort((x,y) => dates[x.guid] < dates[y.guid]);

  return lastestDatas.map(d => ({guid: d.guid, data: decrypt(d.data)}));
};

//need to check authorization at each version?
FilesystemController.getLatestDataAsset = async function(currentDataAsset, username) {
  const sameFirstVersionAssets = (await mongodb.getDataAssetByFirstVersion(currentDataAsset.firstVersion))
    .filter(a => a.owner === username || a.authorizedUsers.includes(username));
  var latestAsset = sameFirstVersionAssets[0];
  sameFirstVersionAssets
    .forEach(a => {
      if (a.lastChangedAt > latestAsset.lastChangedAt) {
        latestAsset = a;
      }
    });

  return latestAsset;
};

FilesystemController.getLatestData = async function(guid, username) {
  const dataAsset = await mongodb.getDataAsset(guid);
  dataAssetExists(dataAsset);

  var latestGlobalUniqueID = (await this.getLatestDataAsset(dataAsset, username)).guid;
  if (!latestGlobalUniqueID) {
    //already latest
    latestGlobalUniqueID = guid;
  }

  const data = await this.getData(latestGlobalUniqueID, username);
  return { guid: latestGlobalUniqueID, data };
};

FilesystemController.getLatestData = async function(guid, username) {
  const dataAsset = await mongodb.getDataAsset(guid);
  dataAssetExists(dataAsset);

  var latestGlobalUniqueID = (await this.getLatestDataAsset(dataAsset, username)).guid;
  if (!latestGlobalUniqueID) {
    //already latest
    latestGlobalUniqueID = guid;
  }

  const data = await this.getData(latestGlobalUniqueID, username);
  return { guid: latestGlobalUniqueID, data };
};

FilesystemController.getPublished = async function(username) {
  if (username) {
    const claimedUser = await mongodb.getUser(username);
    if (claimedUser.role !== 'INSTRUCTOR') {
      throw utils.constructError(`You are not authorized get published data`, statusCodes.UNAUTHORIZED);
    }
  }

  const {sources, otherAssets} = (await mongodb.getAllDataAssets())
    .reduce(({sources, otherAssets}, a) => {
      const validOwnerOrAll = (username && a.owner === username) || !username;
      const isSource = a.sourceOfPublish && a.guid === a.sourceOfPublish;
      if (validOwnerOrAll && isSource) {
        sources.push(a);
      } else {
        otherAssets.push(a);
      }
      return {sources, otherAssets};
    }, {sources: [], otherAssets: []});
  const { latestAssets: latestSources, dates: sourceGuidsDates } = this.organizeToLatestAssets(username, sources);
  const sourceGuidsToPublishedAssets = latestSources.reduce((obj, a) =>  (obj[a.guid] = [], obj), {});

  otherAssets
    .forEach(a => {
      if (Array.isArray(sourceGuidsToPublishedAssets[a.sourceOfPublish])) {
        sourceGuidsToPublishedAssets[a.sourceOfPublish].push(a);
      }
    });

  const sourceGuidsToLatestPublishedGuids = {};
  var guidsToFetch = Object.keys(sourceGuidsToPublishedAssets);
  const guidsToOwners = {};
  for (const [sourceGuid, publishes] of Object.entries(sourceGuidsToPublishedAssets)) {
    const {latestAssets, dates} = this.organizeToLatestAssets(null, publishes);
    const latestGuids = latestAssets.map(a => a.guid);
    guidsToFetch = guidsToFetch.concat(latestGuids);
    latestAssets.forEach(a => guidsToOwners[a.guid] = a.owner);

    sourceGuidsToLatestPublishedGuids[sourceGuid] = {latestGuids, dates};
  }

  const datas = (await mongodb.getDatas(Array.from(new Set(guidsToFetch))))
    .reduce((obj,d)=> (obj[d.guid] = {guid: d.guid, data: decrypt(d.data), owner: guidsToOwners[d.guid]}, obj),{});

  const res = [];
  for (const [sourceGuid, {latestGuids, dates}] of Object.entries(sourceGuidsToLatestPublishedGuids)) {
    latestGuids.sort((x,y) => dates[x.guid] < dates[y.guid]);
    res.push({
      source: datas[sourceGuid],
      published: latestGuids.map(g => datas[g])
    });
  }

  res.sort((x,y) => sourceGuidsDates[x.source.guid] < sourceGuidsDates[y.source.guid]);
  return res;
};

async function processDataForPublish(datas, dataAssets, username, sourceOfPublish, data) {
  const d = JSON.parse(JSON.stringify(data));
  await timeout(1.5); //sleep milliseconds to ensure a unique guid
  d._dateAdded = (new Date()).getTime();
  const encryptedData = encrypt(d);
  const guid = hash(encryptedData);

  datas.push({
    guid: guid,
    data: encryptedData
  });

  dataAssets.push({
    guid,
    originalName: '',
    mimetype: 'application/json',
    lastChangedAt: (new Date()).getTime(),
    active: 1,
    owner: username,
    lastChangedBy: username,
    authorizedUsers: [],
    lastVersion: null,
    firstVersion: guid,
    sourceOfPublish: sourceOfPublish ? sourceOfPublish : guid
  });

  return guid;
}

FilesystemController.publishData = async function(username, data) {
  if ((await mongodb.getUser(username)).role !== 'INSTRUCTOR') {
    throw utils.constructError(`You are not authorized to publish`, statusCodes.UNAUTHORIZED);
  }

  const datas = [];
  const dataAssets = [];
  const guidForInstructor = await processDataForPublish(datas, dataAssets, username, null, data);
  for (const user of (await mongodb.getUsers()).filter(u => u.username !== username)) {
    await processDataForPublish(datas, dataAssets, user.username, guidForInstructor, data);
  }
  await mongodb.postData(datas);
  await mongodb.postDataAsset(dataAssets);
  return { globalUniqueID: guidForInstructor };
};

FilesystemController.populatePublishedDataToNewUser = async function(username) {
  const sources = (await mongodb.getAllDataAssets())
    .filter(a => a.guid === a.sourceOfPublish);
  if (sources.length === 0) {
    return;
  }
  const {latestAssets: publishedAssetGuids, dates} = this.organizeToLatestAssets(null, sources);
  const newDatas = [];
  const newAssets = [];
  const datas = (await mongodb.getDatas(publishedAssetGuids.map(a => a.guid)));
  datas.sort((x,y) => dates[x.guid] > dates[y.guid]);
  for (const d of datas) {
    await timeout(1.5); //sleep milliseconds to ensure a unique guid
    const data = decrypt(d.data);
    data._dateAdded = (new Date()).getTime();
    const encryptedData = encrypt(data);
    const guid = hash(encryptedData);

    newDatas.push({
      guid,
      data: encryptedData
    });
    newAssets.push({
      guid,
      originalName: '',
      mimetype: 'application/json',
      lastChangedAt: (new Date()).getTime(),
      active: 1,
      owner: username,
      lastChangedBy: username,
      authorizedUsers: [],
      lastVersion: null,
      firstVersion: guid,
      sourceOfPublish: d.guid
    });
  }
  await mongodb.postData(newDatas);
  await mongodb.postDataAsset(newAssets);
};

// Trace: retrieve only items that user has access to. only throws 403 if the requested id is unauthorized
FilesystemController.trace = async function(guid, username) {
  var point = await mongodb.getDataAsset(guid);
  if (!point) {
    throw utils.constructError(`Cannot find data asset`, statusCodes.NOT_FOUND);
  }

  const assetVersions = [];
  while (point.lastVersion) {
    assetVersions.push(constructVersion(point));

    const oldAsset = await mongodb.getDataAsset(point.lastVersion);
    if (!oldAsset) {
      // throw utils.constructError(`Could not trace data ${point.lastVersion} or unauthorized user`, statusCodes.NOT_FOUND);
      break;
    }

    point = oldAsset;
  }

  // the oldest data asset has no lastVersion
  if (!point.lastVersion) {
    assetVersions.push(constructVersion(point));
  }

  const allVersions = [];
  for (const asset of assetVersions) {
    try {
      const data = await this.getData(asset.id, username);
      data.lastChangedAt = asset.lastChangedAt;
      data.lastChangedBy = asset.lastChangedBy;
      allVersions.push(data);
    } catch (err) {
      if (err.code === statusCodes.FORBIDDEN) {
        continue;
      }
      throw err;
    }
  }
  return allVersions;
};

// ############################
// Access control
// ############################

FilesystemController.grantAccess = async function(guid, username, grantedUsers) {
  grantedUsers = grantedUsers.map(u => u.toLowerCase());
  const dataAsset = await mongodb.getDataAsset(guid);
  dataAssetExists(dataAsset);
  const names = (await mongodb.getUsers()).map(u => u.username);

  const updatedAuthorizedUsers = Array.from(new Set(grantedUsers)) // no duplicate
    // authorize only usernames that have not been authorized
    .filter(username => username !== dataAsset.owner)
    .filter(username => !dataAsset.authorizedUsers.find(u => u === username));

  const validAuthorizedUsers = [];
  for (const u of updatedAuthorizedUsers) {
    const exist = names.includes(u);
    if (exist) {
      validAuthorizedUsers.push(u);
    } else {
      utils.logger.warn(`<GRANT-ACCESS> ${u} does not exist`);
    }
  }

  if (validAuthorizedUsers.length > 0) {
    dataAsset.authorizedUsers = dataAsset.authorizedUsers.concat(validAuthorizedUsers);
    await dataAsset.save();
  }

  return { newGrantedUsers: validAuthorizedUsers };
};

FilesystemController.revokeAccess = async function(guid, username, userToBeRevoked) {
  userToBeRevoked = userToBeRevoked.toLowerCase();
  // const names = (await mongodb.getUsers()).map(u => u.username);
  // if (!names.includes(userToBeRevoked)) {
  //   throw utils.constructError(`${userToBeRevoked} does not exist`, statusCodes.BAD_REQUEST);
  // }

  const dataAsset = await mongodb.getDataAsset(guid);
  dataAssetExists(dataAsset);
  dataAsset.authorizedUsers = dataAsset.authorizedUsers.filter(user => user !== userToBeRevoked);
  await dataAsset.save();
};

FilesystemController.getAccessInfo = async function(guid, username) {
  const dataAsset = await mongodb.getDataAsset(guid);
  dataAssetExists(dataAsset);
  return { grantedUsers: dataAsset.authorizedUsers };
};