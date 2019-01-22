const uniqid = require('uniqid');
const BC = require('composer-client').BusinessNetworkConnection;
const statusCodes = require('http-status-codes');
const utils = require('../utils');

const ComposerController = {};

const connectionOptions = {
  wallet: {
    type: 'composer-wallet-filesystem',
    options: {
      storePath: require('path').resolve(__dirname, '../../config')
    },
  },
};

const client = new BC(connectionOptions);
let clientConnection;

async function getConnection() {
  if (!clientConnection) {
    clientConnection = await client.connect('admin@dfs');
  } else {
    try {
      await clientConnection.ping();
    } catch (e) {
      clientConnection = await client.connect('admin@dfs');
    }
  }

  return clientConnection;
}

async function submitTransactionAsset(transactionName, opts) {
  const businessNetworkDefinition = await getConnection();
  const factory = businessNetworkDefinition.getFactory();
  const transaction = factory.newResource('org.dfs', transactionName, uniqid());
  transaction.timestamp = new Date();
  const options = opts(factory);
  for (const key in options) {
    if (Object.prototype.hasOwnProperty.call(options, key)) {
      transaction[key] = options[key];
    }
  }
  await (await client.getAssetRegistry(`org.dfs.${transactionName}`)).add(transaction);
}

ComposerController.submitGetData = async(accessor, data) => await submitTransactionAsset('GetData', factory => ({
  accessor: factory.newRelationship('org.dfs', 'User', accessor),
  data: factory.newRelationship('org.dfs', 'Data', data),
}));

ComposerController.submitPostData = async(owner, data) => await submitTransactionAsset('PostData', factory => ({
  owner: factory.newRelationship('org.dfs', 'User', owner),
  data: factory.newRelationship('org.dfs', 'Data', data),
}));

ComposerController.submitPutData = async(updater, oldData, newData) => await submitTransactionAsset('PutData', factory => ({
  updater: factory.newRelationship('org.dfs', 'User', updater),
  oldData: factory.newRelationship('org.dfs', 'Data', oldData),
  newData: factory.newRelationship('org.dfs', 'Data', newData),
}));

ComposerController.registerParticipant = async function(username, role, salt, hashedPassword) {
  const businessNetworkDefinition = await getConnection();
  const newParticipant = businessNetworkDefinition
    .getFactory()
    .newResource('org.dfs', 'User', username);
  newParticipant.role = role;
  newParticipant.salt = salt;
  newParticipant.hashedPassword = hashedPassword;
  const registry = await client.getParticipantRegistry('org.dfs.User');
  try {
    await registry.add(newParticipant);
  } catch (error) {
    throw utils.formatError(error, 'already exists', 'Email already registered', statusCodes.CONFLICT, 'Cannot register');
  }
};

ComposerController.queryGetUser = async function(username) {
  await getConnection();
  const filteredParticipants = await client.query('getUser', { username });
  if (filteredParticipants.length !== 1) {
    throw utils.constructError(`Email is incorrect`, statusCodes.BAD_REQUEST);
  }
  return filteredParticipants[0];
};

ComposerController.getAllData = async function(username) {
  await getConnection();
  const allData = await client.query('getAllData', {
    username: `resource:org.dfs.User#${username}`,
  });
  return allData;
};

ComposerController.getLatestData = async function(currentDataAsset, username) {
  await getConnection();
  // in case of loop
  const checked = new Set([]);
  let latestDataAsset;

  var requestedData = [currentDataAsset];
  while (requestedData.length === 1 && !checked.has(requestedData[0].$identifier)) {
    // if (requestedData[0].owner.$identifier !== username) {
    //   throw `User ${username} is not authorized to access ${requestedData[0].$identifier}`;
    // }
    checked.add(requestedData[0].$identifier);
    latestDataAsset = requestedData[0];
    requestedData = await client.query('getNewerVersionOfData', {
      guid: `resource:org.dfs.Data#${latestDataAsset.$identifier}`,
      username: `resource:org.dfs.User#${username}`,
    });
  }
  return latestDataAsset;
};

ComposerController.getData = async function(guid, username) {
  await getConnection();
  const requestedData = await client.query('getData', {
    guid,
    username: `resource:org.dfs.User#${username}`,
  });
  if (requestedData.length !== 1) {
    throw utils.constructError(`Cannot find data ${guid} or unauthorized user`, statusCodes.NOT_FOUND);
  }
  return requestedData[0];
};

ComposerController.postData = async function(guid, username) {
  const businessNetworkDefinition = await getConnection();
  const factory = businessNetworkDefinition.getFactory();
  const dataAsset = factory.newResource('org.dfs', 'Data', guid);
  const owner = factory.newRelationship('org.dfs', 'User', username);
  const originalName = '';
  dataAsset.originalName = originalName;
  dataAsset.mimetype = 'application/json';
  dataAsset.owner = owner;
  dataAsset.authorizedUsers = [];
  dataAsset.lastChangedAt = new Date();
  dataAsset.lastChangedBy = owner;
  await (await client.getAssetRegistry('org.dfs.Data')).add(dataAsset);
  return dataAsset;
};

ComposerController.putData = async function(oldData, newGuid, username) {
  const businessNetworkDefinition = await getConnection();
  const factory = businessNetworkDefinition.getFactory();
  const dataAsset = factory.newResource('org.dfs', 'Data', newGuid);
  const originalName = '';
  dataAsset.originalName = originalName;
  dataAsset.mimetype = 'application/json';
  dataAsset.authorizedUsers = oldData.authorizedUsers;
  dataAsset.owner = factory.newRelationship('org.dfs', 'User', oldData.owner.$identifier);
  dataAsset.lastVersion = factory.newRelationship('org.dfs', 'Data', oldData.$identifier);
  dataAsset.lastChangedAt = new Date();
  dataAsset.lastChangedBy = factory.newRelationship('org.dfs', 'User', username);
  await (await client.getAssetRegistry('org.dfs.Data')).add(dataAsset);
  return dataAsset;
};

function constructVersion(record) {
  const result = {
    id: record.$identifier,
    lastChangedAt: record.lastChangedAt,
    lastChangedBy: record.lastChangedBy.$identifier
  };

  return JSON.parse(JSON.stringify(result));
}

ComposerController.traceData = async function(guid, username) {
  await getConnection();
  const requestedData = await client.query('getData', {
    guid,
    username: `resource:org.dfs.User#${username}`,
  });
  if (requestedData.length !== 1) {
    throw utils.constructError(`Cannot find data ${guid} or unauthorized user`, statusCodes.NOT_FOUND);
  }

  const allVersions = [];
  let point = requestedData[0];

  while (point.lastVersion) {
    allVersions.push(constructVersion(point));

    const oldData = await client.query('getData', {
      guid: point.lastVersion.$identifier,
      username: `resource:org.dfs.User#${username}`,
    });

    if (oldData.length !== 1) {
      throw utils.constructError(`Could not trace data ${point.lastVersion.$identifier} or unauthorized user`, statusCodes.NOT_FOUND);
    }

    point = oldData[0];
  }

  // the oldest data asset has no lastVersion
  allVersions.push(constructVersion(point));
  return allVersions;
};

ComposerController.grantAccess = async function(guid, username, grantedUsers) {
  const businessNetworkDefinition = await getConnection();
  const requestedData = await client.query('getData', {
    guid,
    username: `resource:org.dfs.User#${username}`,
  });
  if (requestedData.length !== 1) {
    throw utils.constructError(`Cannot find data ${guid} or unauthorized user`, statusCodes.NOT_FOUND);
  }
  const dataAsset = requestedData[0];
  const participants = await client.getParticipantRegistry('org.dfs.User');
  const updatedAuthorizedUsers = Array.from(new Set(grantedUsers)) // no duplicate
    // authorize only usernames that have not been authorized
    .filter(username => username !== dataAsset.owner.$identifier)
    .filter(username => !dataAsset.authorizedUsers.find(relationship => relationship.$identifier === username));

  const validAuthorizedUsers = [];
  for (const username of updatedAuthorizedUsers) {
    const exist = await participants.exists(username);
    if (exist) {
      validAuthorizedUsers.push(businessNetworkDefinition.getFactory().newRelationship('org.dfs', 'User', username));
    }
  }

  if (validAuthorizedUsers.length > 0) {
    dataAsset.authorizedUsers = dataAsset.authorizedUsers.concat(validAuthorizedUsers);
    await (await client.getAssetRegistry('org.dfs.Data')).update(dataAsset);
  }

  return dataAsset;
};

ComposerController.revokeAccess = async function(guid, username, userToBeRevoked) {
  await getConnection();
  const requestedData = await client.query('getData', {
    guid,
    username: `resource:org.dfs.User#${username}`,
  });
  if (requestedData.length !== 1) {
    throw utils.constructError(`Cannot find data ${guid} or unauthorized user`, statusCodes.NOT_FOUND);
  }
  const dataAsset = requestedData[0];
  const participants = await client.getParticipantRegistry('org.dfs.User');
  if (!(await participants.exists(userToBeRevoked)))  {
    throw utils.constructError(`${userToBeRevoked} does not exist`, statusCodes.BAD_REQUEST);
  }
  dataAsset.authorizedUsers = dataAsset.authorizedUsers.filter(user => user.$identifier !== userToBeRevoked);
  await (await client.getAssetRegistry('org.dfs.Data')).update(dataAsset);
  return dataAsset;
};

ComposerController.getAccessInfo = async function(guid, username) {
  await getConnection();
  const requestedData = await client.query('getData', {
    guid,
    username: `resource:org.dfs.User#${username}`,
  });
  if (requestedData.length !== 1) {
    throw utils.constructError(`Cannot find data ${guid} or unauthorized user`, statusCodes.NOT_FOUND);
  }
  return requestedData[0].authorizedUsers.map(user => user.$identifier);
};

module.exports = ComposerController;