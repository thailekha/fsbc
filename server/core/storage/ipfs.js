const pify = require('pify');
const ipfsAPI = require('ipfs-api');

if (!process.env.IPFS_HOST) {
  throw new Error('No IPFS host');
}

function getConnection() {
  return pify(ipfsAPI(process.env.IPFS_HOST, '5001', { protocol: 'http' }));
}

const IPFSController = {};

IPFSController.getData = async function(id) {
  const connection = getConnection();
  const response = await connection.files.cat(id);
  return JSON.parse(response.toString());
};

IPFSController.postData = async function(data) {
  const connection = getConnection();
  const response = await connection.files.add(Buffer.from(JSON.stringify(data)));
  if (response.length !== 1) {
    throw 'Unexpected IPFS response';
  }
  const guid = response[0].path;
  return guid;
};

module.exports = IPFSController;