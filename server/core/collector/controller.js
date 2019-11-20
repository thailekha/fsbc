const fsController = require('../filesystem/controller');
const MongoDBController = require('../data/mongodb');
const utils = require('../utils');

const CollectorController = {};

CollectorController.collectAll = async function(link) {
  const fs = fsController(new MongoDBController(link));
  const csvTables = (await fs.getPublished())
    .map(tasks => {
      const { source : { data: s, }, published } = tasks;
      const { name, estimatedHours, notes, estimatedStress, regulatedStartDate, regulatedEndDate } = s;

      const studentRows = published
        .map(({ owner, data: { startTime, endTime, duration, stress, comments }}) =>
          [ owner, name, estimatedHours, notes, estimatedStress, utils.prettyDate(regulatedStartDate), utils.prettyDate(regulatedEndDate), utils.prettyDate(startTime), utils.prettyDate(endTime), utils.durationToMinutes(duration), stress, comments ]);

      return {
        name,
        csv: [["student", "name", "estimatedHours", "notes", "estimatedStress", "regulatedStartDate", "regulatedEndDate", "startTime", "endTime", "duration", "stress", "comments"]]
          .concat(studentRows)
      };
    });
  return csvTables;
};

module.exports = CollectorController;