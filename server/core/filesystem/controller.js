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

async function atOnce(...promises) {
  return await Promise.all(promises);
}

// ############################
// Encryption
// ############################

if (!process.env.DATAENCRYPT_SECRET) {
  throw new Error('DATAENCRYPT_SECRET not set');
}

const ALGORITHM = 'aes-256-cbc';
const PASSWORD = process.env.DATAENCRYPT_SECRET;

const needJsonStringify = data => !(data instanceof Buffer) && (data instanceof Object || typeof data === 'object');

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

function processDataAndAsset(content, asset, firstVersion) {
  const encryptedData = encrypt(content);

  // hash the data together with the asset to enforce uniqueness if 2 users add the same data content
  const guid = hash({
    encryptedData,
    metadata: asset
  });
  asset.guid = guid;
  asset.firstVersion = firstVersion ? firstVersion : guid;
  return {
    data: {
      guid: guid,
      data: encryptedData
    },
    asset
  };
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
  const processed = processDataAndAsset(data, {
    originalName: '',
    mimetype: 'application/json',
    lastChangedAt: (new Date()).getTime(),
    active: 1,
    owner: username,
    lastChangedBy: username,
    authorizedUsers: [],
    lastVersion: null,
    sourceOfPublish: null
  });
  await atOnce(
    mongodb.postData(processed.data),
    mongodb.postDataAsset(processed.asset)
  );
  return { globalUniqueID: processed.data.guid };
};

FilesystemController.getData = async function(guid, username) {
  const [dataAsset, data] = await atOnce(mongodb.getDataAsset(guid), mongodb.getData(guid));
  validateAccessDataAsset(data, dataAsset, username);
  return decrypt(data.data);
};

FilesystemController.putData = async function(guid, username, data) {
  const [dataAsset, oldData] = await atOnce(mongodb.getDataAsset(guid), mongodb.getData(guid));
  validateAccessDataAsset(oldData, dataAsset, username);

  const processed = processDataAndAsset(data, {
    originalName: dataAsset.originalName,
    mimetype: dataAsset.mimetype,
    lastChangedAt: (new Date()).getTime(),
    active: 1,
    owner: dataAsset.owner,
    lastChangedBy: username,
    authorizedUsers: dataAsset.authorizedUsers,
    lastVersion: guid,
    sourceOfPublish: dataAsset.sourceOfPublish
  }, dataAsset.firstVersion);

  await atOnce(
    mongodb.postData(processed.data),
    mongodb.postDataAsset(processed.asset)
  );

  return { globalUniqueID: processed.data.guid };
};

// ############################
// Advanced
// ############################

/**
 * Make sure assets have been filtered with owner === username || authorizedUsers.includes(username)
 */
FilesystemController.organizeToLatestAssets = function(assets) {
  var latestAssets = {};
  assets
    .forEach(a => {
      if (!latestAssets[a.firstVersion] || latestAssets[a.firstVersion].lastChangedAt < a.lastChangedAt) {
        latestAssets[a.firstVersion] = a;
      }
    });
  latestAssets = Object.values(latestAssets);
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
  const {latestAssets, dates} = this.organizeToLatestAssets(await mongodb.getAllDataAssetsOfUser(username));
  const lastestDatas = await mongodb.getDatas(latestAssets.map(d => d.guid));
  lastestDatas.sort((x,y) => dates[x.guid] < dates[y.guid]);

  return lastestDatas.map(d => ({guid: d.guid, data: decrypt(d.data)}));
};

//need to check authorization at each version?
FilesystemController.getLatestDataAsset = async function(currentDataAsset, username) {
  const sameFirstVersionAssets = (await mongodb.getDataAssetByFirstVersion(currentDataAsset.firstVersion, username));
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
  const { latestAssets: latestSources, dates: sourceGuidsDates } = this.organizeToLatestAssets(sources);
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
    const {latestAssets, dates} = this.organizeToLatestAssets(publishes);
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

function processDataForPublish(datas, dataAssets, username, sourceOfPublish, forPublish) {
  const processed = processDataAndAsset(JSON.parse(JSON.stringify(forPublish)), {
    originalName: '',
    mimetype: 'application/json',
    lastChangedAt: (new Date()).getTime(),
    active: 1,
    owner: username,
    lastChangedBy: username,
    authorizedUsers: [],
    lastVersion: null
  });
  processed.asset.sourceOfPublish = sourceOfPublish ? sourceOfPublish : processed.data.guid;
  datas.push(processed.data);
  dataAssets.push(processed.asset);
  return processed.data.guid;
}

FilesystemController.publishData = async function(username, data) {
  const otherUsers = [];
  const instructor = [];
  (await mongodb.getUsers())
    .forEach(u => {
      if (u.username === username && u.role === 'INSTRUCTOR') {
        instructor.push(u);
      } else if (u.username !== username) {
        otherUsers.push(u);
      }
    });
  if (instructor.length !== 1) {
    throw utils.constructError(`You are not authorized to publish`, statusCodes.UNAUTHORIZED);
  }

  const datas = [];
  const dataAssets = [];
  const guidForInstructor = processDataForPublish(datas, dataAssets, username, null, data);
  // const publishPromises = [];
  for (const user of otherUsers) {
    // processDataForPublish needs to sleep for 1.5 secs each so avoid Promise.all
    processDataForPublish(datas, dataAssets, user.username, guidForInstructor, data);
  }
  // await Promise.all(publishPromises);
  await atOnce( mongodb.postData(datas), mongodb.postDataAsset(dataAssets) );
  return { globalUniqueID: guidForInstructor };
};

FilesystemController.populatePublishedDataToNewUser = async function(username) {
  const sources = await mongodb.getDataAssetsWhereGuidEqSourceOfPublish();
  if (sources.length === 0) {
    return;
  }
  const {latestAssets: publishedAssetGuids, dates} = this.organizeToLatestAssets(sources);
  const newDatas = [];
  const newAssets = [];
  const datas = (await mongodb.getDatas(publishedAssetGuids.map(a => a.guid)));
  datas.sort((x,y) => dates[x.guid] > dates[y.guid]);
  for (const d of datas) {
    const data = decrypt(d.data);
    const processed = processDataAndAsset(data, {
      originalName: '',
      mimetype: 'application/json',
      lastChangedAt: (new Date()).getTime(),
      active: 1,
      owner: username,
      lastChangedBy: username,
      authorizedUsers: [],
      lastVersion: null,
      sourceOfPublish: d.guid
    });
    newDatas.push(processed.data);
    newAssets.push(processed.asset);
  }
  await atOnce( mongodb.postData(newDatas), mongodb.postDataAsset(newAssets) );
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