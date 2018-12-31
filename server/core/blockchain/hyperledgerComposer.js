const uniqid = require('uniqid');
const BC = require('composer-client').BusinessNetworkConnection;

const ComposerController = {};

const connectionOptions = {
  wallet: {
    type: 'composer-wallet-filesystem',
    options: {
      storePath: require('path').resolve(__dirname, '../../config')
    },
  },
};

const clientConnection = new BC(connectionOptions);

async function submitTransactionAsset(transactionName, opts) {
  const businessNetworkDefinition = await clientConnection.connect('admin@dfs');
  const factory = businessNetworkDefinition.getFactory();
  const transaction = factory.newResource('org.dfs', transactionName, uniqid());
  transaction.timestamp = new Date();
  const options = opts(factory);
  for (const key in options) {
    if (Object.prototype.hasOwnProperty.call(options, key)) {
      transaction[key] = options[key];
    }
  }
  await (await clientConnection.getAssetRegistry(`org.dfs.${transactionName}`)).add(transaction);
  await clientConnection.disconnect();
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
  const businessNetworkDefinition = await clientConnection.connect('admin@dfs');
  const newParticipant = businessNetworkDefinition
    .getFactory()
    .newResource('org.dfs', 'User', username);
  newParticipant.role = role;
  newParticipant.salt = salt;
  newParticipant.hashedPassword = hashedPassword;
  await (await clientConnection.getParticipantRegistry('org.dfs.User')).add(newParticipant);
  await clientConnection.disconnect();
};

ComposerController.queryGetUser = async function(username) {
  await clientConnection.connect('admin@dfs');
  const filteredParticipants = await clientConnection.query('getUser', { username });
  await clientConnection.disconnect();
  if (filteredParticipants.length !== 1) {
    throw `Cannot find user ${username}`;
  }
  return filteredParticipants[0];
};

ComposerController.getAllData = async function(username) {
  await clientConnection.connect('admin@dfs');
  const allData = await clientConnection.query('getAllData', {
    username: `resource:org.dfs.User#${username}`,
  });
  await clientConnection.disconnect();
  return allData;
};

ComposerController.getLatestData = async function(currentDataAsset, username) {
  await clientConnection.connect('admin@dfs');
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
    requestedData = await clientConnection.query('getNewerVersionOfData', {
      guid: `resource:org.dfs.Data#${latestDataAsset.$identifier}`,
      username: `resource:org.dfs.User#${username}`,
    });
  }
  await clientConnection.disconnect();
  return latestDataAsset;
};

ComposerController.getData = async function(guid, username) {
  await clientConnection.connect('admin@dfs');
  const requestedData = await clientConnection.query('getData', {
    guid,
    username: `resource:org.dfs.User#${username}`,
  });
  await clientConnection.disconnect();
  if (requestedData.length !== 1) {
    throw `Cannot find data ${guid} or unauthorized user`;
  }
  return requestedData[0];
};

ComposerController.postData = async function(guid, username) {
  const businessNetworkDefinition = await clientConnection.connect('admin@dfs');
  const factory = businessNetworkDefinition.getFactory();
  const dataAsset = factory.newResource('org.dfs', 'Data', guid);
  const originalName = '';
  dataAsset.originalName = originalName;
  dataAsset.mimetype = 'application/json';
  dataAsset.owner = factory.newRelationship('org.dfs', 'User', username);
  dataAsset.authorizedUsers = [];
  dataAsset.lastChangedAt = new Date();
  await (await clientConnection.getAssetRegistry('org.dfs.Data')).add(dataAsset);
  await clientConnection.disconnect();
};

ComposerController.putData = async function(oldData, newGuid) {
  const businessNetworkDefinition = await clientConnection.connect('admin@dfs');
  const factory = businessNetworkDefinition.getFactory();
  const dataAsset = factory.newResource('org.dfs', 'Data', newGuid);
  const originalName = '';
  dataAsset.originalName = originalName;
  dataAsset.mimetype = 'application/json';
  dataAsset.authorizedUsers = oldData.authorizedUsers;
  dataAsset.owner = factory.newRelationship('org.dfs', 'User', oldData.owner.$identifier);
  dataAsset.lastVersion = factory.newRelationship('org.dfs', 'Data', oldData.$identifier);
  dataAsset.lastChangedAt = new Date();
  await (await clientConnection.getAssetRegistry('org.dfs.Data')).add(dataAsset);
  await clientConnection.disconnect();
  return dataAsset;
};

ComposerController.traceData = async function(guid, username) {
  await clientConnection.connect('admin@dfs');
  const requestedData = await clientConnection.query('getData', {
    guid,
    username: `resource:org.dfs.User#${username}`,
  });
  if (requestedData.length !== 1) {
    throw `Cannot find data ${guid} or unauthorized user`;
  }

  const allVersionIDs = [];
  let point = requestedData[0];

  while (point.lastVersion) {
    allVersionIDs.push(point.$identifier);

    const oldData = await clientConnection.query('getData', {
      guid: point.lastVersion.$identifier,
      username: `resource:org.dfs.User#${username}`,
    });

    if (oldData.length !== 1) {
      throw `Could not trace data ${point.lastVersion.$identifier} or unauthorized user`;
    }

    point = oldData[0];
  }

  // the oldest data asset has no lastVersion
  allVersionIDs.push(point.$identifier);
  await clientConnection.disconnect();
  return allVersionIDs;
};

ComposerController.grantAccess = async function(guid, username, grantedUsers) {
  const businessNetworkDefinition = await clientConnection.connect('admin@dfs');
  const requestedData = await clientConnection.query('getData', {
    guid,
    username: `resource:org.dfs.User#${username}`,
  });
  if (requestedData.length !== 1) {
    throw `Cannot find data ${guid} or unauthorized user`;
  }
  const dataAsset = requestedData[0];
  const updatedAuthorizedUsers = Array.from(new Set(grantedUsers)) // no duplicate
    // authorize only usernames that have not been authorized
    .filter(username => username !== dataAsset.owner.$identifier && !dataAsset.authorizedUsers.find(relationship => relationship.$identifier === username))
    .map(username => businessNetworkDefinition.getFactory().newRelationship('org.dfs', 'User', username));

  if (updatedAuthorizedUsers.length > 0) {
    dataAsset.authorizedUsers = dataAsset.authorizedUsers.concat(updatedAuthorizedUsers);
    await (await clientConnection.getAssetRegistry('org.dfs.Data')).update(dataAsset);
  }
  await clientConnection.disconnect();
};

module.exports = ComposerController;