const mongodb = require('../data/mongodb');
const crypto = require('crypto');
const hash = require('object-hash');
const statusCodes = require('http-status-codes');
const utils = require('../utils');

const FilesystemController = {};

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

function validateAccessDataAsset(data, dataAsset, username) {
  //check user exists
  if (!data) {
    throw utils.constructError(`Cannot find data`, statusCodes.NOT_FOUND);
  }
  if (!dataAsset) {
    throw utils.constructError(`Cannot find data asset`, statusCodes.NOT_FOUND);
  }
  const valid = dataAsset.owner === username || dataAsset.authorizedUsers.includes(username);
  if (!valid) {
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
    lastVersion: null
  });
  return { globalUniqueID: guid};
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
    lastVersion: guid
  });

  return { globalUniqueID: newGuid };
};

// ############################
// Advanced
// ############################

FilesystemController.getAllData = async function(username) {
  const dataAssets = (await mongodb.getDataAssets())
    .filter(a => a.owner === username || a.authorizedUsers.includes(username));

  const latestAssets = [];
  for (const asset of dataAssets) {
    const latest = await this.getLatestDataAsset(asset, username);
    if (latest && latestAssets.findIndex(i => i.guid === latest.guid) < 0) {
      latestAssets.push(latest);
    }
  }
  // change lastChangedAt schema to int?
  latestAssets.sort((x,y) => x.lastChangedAt < y.lastChangedAt);

  const latestDatas = [];
  for (const guid of latestAssets.map(d => d.guid)) {
    const data = await this.getData(guid, username);
    latestDatas.push({ guid, data });
  }

  return latestDatas;
};

FilesystemController.getLatestDataAsset = async function(currentDataAsset, username) {
  // in case of loop
  const checked = new Set([]);
  let latestDataAsset;

  var requestedData = [currentDataAsset];
  while (requestedData.length === 1 && !checked.has(requestedData[0].guid)) {
    //need to check authorization at each version?
    checked.add(requestedData[0].guid);
    latestDataAsset = requestedData[0];
    requestedData = await mongodb.getNewerVersionOfDataAsset(latestDataAsset.guid);
    requestedData = requestedData ? [requestedData] : [];
  }
  return latestDataAsset;
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

function constructVersion(asset) {
  const result = {
    id: asset.guid,
    lastChangedAt: asset.lastChangedAt,
    lastChangedBy: asset.lastChangedBy
  };

  return JSON.parse(JSON.stringify(result));
}

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

module.exports = FilesystemController;