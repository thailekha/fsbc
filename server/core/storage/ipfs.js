const pify = require('pify');
const ipfsAPI = require('ipfs-api');
const services = require('../service-discovery/controller');
const shell = require('../shell/controller');
const timeout = require('async').timeout;
const r = require('ramda');

// if (!process.env.IPFS_HOST) {
//   throw new Error('No IPFS host');
// }

const IPFSController = {};

const IPFSConnection = ipAddress => pify(ipfsAPI(ipAddress, '5001', { protocol: 'http' }));

// caolan's async's timeout does not support async function as a parameter, so cannot use await
// so have to use oldshool callback when calling ipfsAPI
function coreValidator(ipAddress, timeoutCallback) {
  ipfsAPI(ipAddress, '5001', { protocol: 'http' })
    .id((err, identity) => {
      if (err) {
        return timeoutCallback(err);
      }
      timeoutCallback(null, identity);
    });
}

// have to be curried (read more about curry in functional programming)
const curriedCoreValidator = r.curry(coreValidator);

async function validator(ipAddress) {
  try {
    const timeoutWrapped = pify(timeout(curriedCoreValidator(ipAddress), 2000));
    await timeoutWrapped();
    return true;
  } catch (e) {
    // console.log(ipAddress, e);
    return false;
  }
}
IPFSController.validator = validator;

async function getConnection() {
  return IPFSConnection(await services.getService(validator));
}

IPFSController.getData = async function(id) {
  const connection = await getConnection();
  const response = await connection.files.cat(id);
  return JSON.parse(response.toString());
};

IPFSController.postData = async function(data) {
  const connection = await getConnection();
  const response = await connection.files.add(Buffer.from(JSON.stringify(data)));
  if (response.length !== 1) {
    throw 'Unexpected IPFS response';
  }
  const guid = response[0].path;
  return guid;
};

IPFSController.startDaemon = async function() {
  await shell.shellexec('echo $(ipfs daemon > /dev/null 2>&1 &) && sleep 2');
};

IPFSController.killDaemon = async function() {
  await shell.killProcessListeningOnPort('4001');
};

module.exports = IPFSController;