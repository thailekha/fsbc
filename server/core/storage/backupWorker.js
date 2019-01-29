const blockchainController = require('../blockchain/controller');
const mongodb = require('./mongodb');
const utils = require('../utils');

const env = require('dotenv').config();
if (env.error) {
  throw env.error;
}

const intervalHour = 0.5;
const interval = intervalHour * 60 * 60 * 1000; // hour * min * sec * millisec
var runningBackup = false;

async function backup() {
  const errors = [];
  const {assets, participants} = await blockchainController.getBackup();
  const participantToUserSchema = ({username, hashedPassword, salt, role}) => ({username, hashedPassword, salt, role});
  const assetToAssetSchema = ({guid,originalName,mimetype,lastChangedAt,active,owner,lastChangedBy,authorizedUsers,lastVersion}) =>
    ({guid,
      originalName,
      mimetype,
      lastChangedAt,
      active,
      owner: owner.$identifier,
      lastChangedBy: lastChangedBy.$identifier,
      authorizedUsers: authorizedUsers.map(u => u.$identifier),
      lastVersion: lastVersion ? lastVersion.$identifier: lastVersion
    });
  const pushError = (errors, type, id, error) => errors.push(`<BACKUP-WORKER> Could not backup ${type} ${id}, error: ${error}`);

  utils.logger.info(`${assets.length} assets, ${participants.length} participants`);

  for (const participant of participants) {
    try {
      await mongodb.addOrUpdateParticipant(participantToUserSchema(participant));
    } catch (error) {
      pushError(errors, 'participant', participant.$identifier, error);
    }
  }

  for (const asset of assets) {
    try {
      await mongodb.addOrUpdateDataAsset(assetToAssetSchema(asset));
    } catch (error) {
      pushError(errors, 'asset', asset.$identifier, error);
    }
  }

  errors.forEach(e => utils.logger.error(e));
}

utils.logger.info(`Backup after ${intervalHour} hours`);
setInterval(async function() {
  if (runningBackup) {
    utils.logger.info('Backup is running, skipping ...');
    return;
  }
  runningBackup = true;
  utils.logger.info(`${intervalHour} hours has passed, running backup ...`);
  try {
    await backup();
  } catch (error) {
    utils.logger.error(`Error from backup data ${error}`);
  }
  utils.logger.info('Backup complete!');
  runningBackup = false;
}, interval);