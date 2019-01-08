const composer = require('./hyperledgerComposer');
const BlockchainController = {};

BlockchainController.submitGetData = composer.submitGetData;
BlockchainController.submitPostData = composer.submitPostData;
BlockchainController.submitPutData = composer.submitPutData;

BlockchainController.registerParticipant = composer.registerParticipant;
BlockchainController.queryGetUser = composer.queryGetUser;

BlockchainController.getAllData = composer.getAllData;
BlockchainController.getLatestData = composer.getLatestData;
BlockchainController.getData = composer.getData;
BlockchainController.postData = composer.postData;
BlockchainController.putData = composer.putData;
BlockchainController.traceData = composer.traceData;
BlockchainController.grantAccess = composer.grantAccess;

module.exports = BlockchainController;