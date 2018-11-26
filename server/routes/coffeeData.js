const express = require('express');
const router = express.Router();
const uniqid = require('uniqid');
const path = require('path');
const jwt = require('jsonwebtoken');
const ipfsAPI = require('ipfs-api');
const pify = require('pify');
const crypto = require('crypto');

const connectionOptions = {
  wallet : {
      type: 'composer-wallet-filesystem',
      options : {
          storePath : path.resolve(__dirname,'../config')
      }
  }
};

if(!process.env.IPFS_HOST) {
  throw "No IPFS host"
}

const ipfs = pify(ipfsAPI(process.env.IPFS_HOST, '5001', {protocol: 'http'}));

const bc = require('composer-client').BusinessNetworkConnection;
const clientConnection = new bc(connectionOptions);

async function registerParticipant(username, salt, hashedPassword, clientConnection, businessNetworkDefinition) {
  const newParticipant = businessNetworkDefinition
    .getFactory()
    .newResource('org.dfs', 'DataOwner', username);
  console.log(salt);
  newParticipant.salt = salt;
  newParticipant.hashedPassword = hashedPassword;
  await (await clientConnection.getParticipantRegistry('org.dfs.DataOwner')).add(newParticipant);
}

async function submitGetData(requesterID, dataID, businessNetworkDefinition) {
  const factory = businessNetworkDefinition.getFactory();
  const accessDataTransaction = factory.newResource('org.dfs', 'GetData', uniqid());
  accessDataTransaction.timestamp = new Date();
  accessDataTransaction.requester = factory.newRelationship('org.dfs', 'DataOwner', requesterID);
  accessDataTransaction.data = factory.newRelationship('org.dfs', 'Data', dataID);
  await (await clientConnection.getAssetRegistry('org.dfs.GetData')).add(accessDataTransaction);
}

async function submitPostData(ownerID, dataID, businessNetworkDefinition) {
  const factory = businessNetworkDefinition.getFactory();
  const postDataTransaction = factory.newResource('org.dfs', 'PostData', uniqid());
  postDataTransaction.timestamp = new Date();
  postDataTransaction.owner = factory.newRelationship('org.dfs', 'DataOwner', ownerID);
  postDataTransaction.data = factory.newRelationship('org.dfs', 'Data', dataID);
  await (await clientConnection.getAssetRegistry('org.dfs.PostData')).add(postDataTransaction);
}

async function submitPutData(updaterID, oldDataID, newDataID, businessNetworkDefinition) {
  const factory = businessNetworkDefinition.getFactory();
  const putDataTransaction = factory.newResource('org.dfs', 'PutData', uniqid());
  putDataTransaction.timestamp = new Date();
  putDataTransaction.updater = factory.newRelationship('org.dfs', 'DataOwner', updaterID);
  putDataTransaction.oldData = factory.newRelationship('org.dfs', 'Data', oldDataID);
  putDataTransaction.newData = factory.newRelationship('org.dfs', 'Data', newDataID);
  await (await clientConnection.getAssetRegistry('org.dfs.PutData')).add(putDataTransaction);
}

function genRandomString(length){
  return crypto.randomBytes(Math.ceil(length/2))
    .toString('hex') /** convert to hexadecimal format */
    .slice(0,length);   /** return required number of characters */
};

function sha512(password, salt){
  const hash = crypto.createHmac('sha512', salt); /** Hashing algorithm sha512 */
  hash.update(password);
  return hash.digest('hex');
};

router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.post('/register', async function(req, res, next) {
  try {
    const businessNetworkDefinition = await clientConnection.connect("admin@dfs");
    const salt = genRandomString(16);
    await registerParticipant(req.body.username, salt, sha512(req.body.password, salt), clientConnection, businessNetworkDefinition);
    res.end();
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.post('/login', async function(req, res, next) {
  try {
    const username = req.body.username;
    const password = req.body.password;

    await clientConnection.connect("admin@dfs");
    const filteredParticipants = await clientConnection.query('getDataOwner', {username});;
    
    if (filteredParticipants.length !== 1) {
      throw `Cannot find user ${username}`;
    }

    const claimedUser = filteredParticipants[0];

    if (sha512(password, claimedUser.salt) !== claimedUser.hashedPassword) {
      throw `Invalid password`;
    }

    const token = jwt.sign({username: claimedUser.$identifier}, 'secret', {expiresIn: '5h'});

    res.json({token});
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.get('/file/:id', async function(req, res, next) {
  try {
    const token = req.header("Authorization").split('Bearer ')[1];
    const username = jwt.verify(token, 'secret').username;
    const requestedDataID = req.params.id;
    const businessNetworkDefinition = await clientConnection.connect("admin@dfs");
    const requestedData = await clientConnection.query('getData', {guid: requestedDataID});

    if (requestedData.length !== 1) {
      throw `Cannot find user ${username} or data ${requestedDataID}`;
    }

    const ipfs = pify(ipfsAPI(process.env.IPFS_HOST, '5001', {protocol: 'http'}));
    const ipfsResponse = await ipfs.files.cat(requestedData[0].guid);
    await submitGetData(username,requestedData[0].$identifier,businessNetworkDefinition);

    res
      .set('Content-Disposition', `attachment; filename="${requestedData[0].originalName}"`)
      .set('Content-Type', requestedData[0].mimetype)
      .end(ipfsResponse);
  } catch (err) {
  	console.log(err);
  	next(err);
  }
});

// [ { path: 'QmcrHFQ5SnDEEZZuWXQbYvsam1k1bRJwajrQgMTAwKT7oA',
// hash: 'QmcrHFQ5SnDEEZZuWXQbYvsam1k1bRJwajrQgMTAwKT7oA',
// size: 121 } ]
router.post('/file', async function(req, res, next) {
  try {
    const token = req.header("Authorization").split('Bearer ')[1];
    const username = jwt.verify(token, 'secret').username;
    const businessNetworkDefinition = await clientConnection.connect("admin@dfs");
    const filteredParticipants = await clientConnection.query('getDataOwner', {username});

    if (filteredParticipants.length !== 1) {
      throw `Cannot find user ${username}`;
    }

    const owner = filteredParticipants[0];

    //TODO encrypt the file

    const ipfs = pify(ipfsAPI(process.env.IPFS_HOST, '5001', {protocol: 'http'}));
    const ipfsResponse = await ipfs.files.add(req.files.file.data);

    if (ipfsResponse.length !== 1) {
      throw "Unexpected IPFS response"
    }

    const guid = ipfsResponse[0].path;
    const originalName = req.files.file.name;
    const factory = businessNetworkDefinition.getFactory();
    const dataAsset = factory.newResource('org.dfs', 'Data', guid);
    dataAsset.originalName = originalName;
    dataAsset.mimetype = req.files.file.mimetype;
    dataAsset.owner = factory.newRelationship('org.dfs','DataOwner',owner.$identifier);
    await (await clientConnection.getAssetRegistry('org.dfs.Data')).add(dataAsset);
    await submitPostData(owner.$identifier,dataAsset.$identifier,businessNetworkDefinition);

    res.json({globalUniqueID: guid});
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.get('/:id', async function(req, res, next) {
  try {
    const token = req.header("Authorization").split('Bearer ')[1];
    const username = jwt.verify(token, 'secret').username;
    const requestedDataID = req.params.id;
    const businessNetworkDefinition = await clientConnection.connect("admin@dfs");
    const requestedData = await clientConnection.query('getData', {guid: requestedDataID});

    if (requestedData.length !== 1) {
      throw `Cannot find data ${requestedDataID}`;
    }

    const ipfs = pify(ipfsAPI(process.env.IPFS_HOST, '5001', {protocol: 'http'}));
    const ipfsResponse = await ipfs.files.cat(requestedData[0].guid);
    await submitGetData(username,requestedData[0].$identifier,businessNetworkDefinition);

    res
      .json(JSON.parse(ipfsResponse.toString()));
  } catch (err) {
  	console.log(err);
  	next(err);
  }
});

router.post('/', async function(req, res, next) {
  try {
    const token = req.header("Authorization").split('Bearer ')[1];
    const username = jwt.verify(token, 'secret').username;
    const businessNetworkDefinition = await clientConnection.connect("admin@dfs");
    const filteredParticipants = await clientConnection.query('getDataOwner', {username});

    if (filteredParticipants.length !== 1) {
      throw `Cannot find user ${username}`;
    }

    const owner = filteredParticipants[0];

    // const tempFilename = uniqid();
    // await jsonfile.writeFile(`/tmp/${tempFilename}`, req.body, {spaces: 2});

    //TODO encrypt the file

    
    const ipfsResponse = await ipfs.files.add(Buffer.from(JSON.stringify(req.body)));
    if (ipfsResponse.length !== 1) {
      throw "Unexpected IPFS response"
    }

    const guid = ipfsResponse[0].path;
    const originalName = "";
    const factory = businessNetworkDefinition.getFactory();
    const dataAsset = factory.newResource('org.dfs', 'Data', guid);
    dataAsset.originalName = originalName;
    dataAsset.mimetype = 'application/json';
    dataAsset.owner = factory.newRelationship('org.dfs','DataOwner',owner.$identifier);
    await (await clientConnection.getAssetRegistry('org.dfs.Data')).add(dataAsset);
    await submitPostData(owner.$identifier,dataAsset.$identifier,businessNetworkDefinition);

    res.json({globalUniqueID: guid});
  } catch (err) {
    console.log(err);
    next(err);
  }
});

// from ipfs pov, just like post
// from composer pov, ...
router.put('/:id', async function(req, res, next) {
  try {
    const token = req.header("Authorization").split('Bearer ')[1];
    const username = jwt.verify(token, 'secret').username;
    const requestedDataID = req.params.id;
    const businessNetworkDefinition = await clientConnection.connect("admin@dfs");

    const filteredParticipants = await clientConnection.query('getDataOwner', {username});

    if (filteredParticipants.length !== 1) {
      throw `Cannot find user ${username}`;
    }

    const updater = filteredParticipants[0];

    const requestedData = await clientConnection.query('getData', {guid: requestedDataID});

    if (requestedData.length !== 1) {
      throw `Cannot find data ${requestedDataID}`;
    }

    const ipfsResponse = await ipfs.files.add(Buffer.from(JSON.stringify(req.body)));
    if (ipfsResponse.length !== 1) {
      throw "Unexpected IPFS response"
    }

    const guid = ipfsResponse[0].path;
    const originalName = "";
    const factory = businessNetworkDefinition.getFactory();
    const dataAsset = factory.newResource('org.dfs', 'Data', guid);
    dataAsset.originalName = originalName;
    dataAsset.mimetype = 'application/json';
    console.log(requestedData[0].owner.$identifier);
    dataAsset.owner = factory.newRelationship('org.dfs','DataOwner',requestedData[0].owner.$identifier);
    dataAsset.lastVersion = factory.newRelationship('org.dfs','Data',requestedData[0].$identifier);

    await (await clientConnection.getAssetRegistry('org.dfs.Data')).add(dataAsset);
    await submitPutData(updater.$identifier,requestedData[0].$identifier,dataAsset.$identifier,businessNetworkDefinition);
    res.json({globalUniqueID: guid});
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.get('/:id/trace', async function(req, res, next) {
  try {
    const token = req.header("Authorization").split('Bearer ')[1];
    const username = jwt.verify(token, 'secret').username;
    const requestedDataID = req.params.id;
    const businessNetworkDefinition = await clientConnection.connect("admin@dfs");
    const requestedData = await clientConnection.query('getData', {guid: requestedDataID});

    if (requestedData.length !== 1) {
      throw `Cannot find user ${username} or data ${requestedDataID}`;
    }

    const allVersionIDs = [];
    var point = requestedData[0];

    while (point.lastVersion) {
      allVersionIDs.push(point.$identifier);

      const oldData = await clientConnection.query('getData', {guid: point.lastVersion.$identifier});

      if (oldData.length !== 1) {
        throw `Could not trace data ${point.lastVersion.$identifier}`;
      }

      point = oldData[0];
    }

    // the oldest data asset has no lastVersion
    allVersionIDs.push(point.$identifier);

    allVersions = [];
    for (var versionID of allVersionIDs) {
      const ipfsResponse = (await ipfs.files.cat(versionID)).toString();
      allVersions.push(JSON.parse(ipfsResponse));
    }

    res.json(allVersions);
  } catch (err) {
  	console.log(err);
  	next(err);
  }
});

module.exports = router;
