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
        .map(({ owner, data: { startTime, endTime, duration, stresses, stress, comments, overallStress }}) =>
          [
            owner,
            name,
            estimatedHours,
            notes,
            estimatedStress,
            utils.prettyDate(regulatedStartDate),
            utils.prettyDate(regulatedEndDate),
            startTime ? utils.prettyDate(startTime) : 'N/A',
            endTime ? utils.prettyDate(endTime) : 'N/A',
            duration ? utils.durationToMinutes(duration) : 'N/A',
            stresses ? stresses : 'N/A',
            stress ? stress : 'N/A',
            comments ? comments : 'N/A',
            overallStress ? overallStress : 'N/A'
          ]);

      return {
        name,
        csv: [[
          "Student",
          "Name",
          "Estimated Hours",
          "Notes",
          "Estimated Stress",
          "Regulated Start Date",
          "Regulated End Date",
          "Start Time",
          "End Time",
          "Duration",
          "Stress scores",
          "Mean Stress",
          "Comments",
          "Overall Stress"
        ]]
          .concat(studentRows)
      };
    });
  return csvTables;
};

module.exports = CollectorController;