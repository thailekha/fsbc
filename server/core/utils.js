const Utils = {};
const chalk = require('chalk');
const moment = require('moment');

Utils.constructError = function(msg, code) {
  const err = new Error(msg);
  err.code = code;
  return err;
};

function checkClue(msg, clue) {
  return msg && clue && msg.toLowerCase().includes(clue.toLowerCase());
}

Utils.formatError = function(err, clue, msg, code, defaultMsg) {
  let canFormat;
  if (typeof err === 'string') {
    canFormat = checkClue(err, clue);
    return this.constructError(canFormat ? msg : defaultMsg, code);
  }

  if (err.code && err.message) {
    return err;
  }

  canFormat = checkClue(err.message, clue);
  err.message = canFormat ? msg : defaultMsg;
  if (canFormat && code) {
    err.code = code;
  }
  return err;
};

Utils.logger = {
  info: msg => console.log(chalk.bgBlue(`[FSBC-LOGGER] ${msg}`)),
  warn: msg => console.log(chalk.bgYellow(`[FSBC-LOGGER] ${msg}`)),
  error: msg => console.log(chalk.bgRed(`[FSBC-LOGGER] ${msg}`))
};

Utils.prettyDate = function(unixTimestamp) {
  return moment(unixTimestamp).format("dddd, MMMM Do YYYY, h:mm:ss a");
}

Utils.durationToMinutes = function(duration) {
  const toSeconds = duration / 1000;
  const toMinutes = toSeconds / 60;
  const rounded = Math.round(toMinutes * 100) / 100;
  return rounded;
}

module.exports = Utils;