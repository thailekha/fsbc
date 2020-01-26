const uniqid = require('uniqid');

const testUtils = {};

testUtils.generateUser = function() {
  return {
    username: `test${uniqid()}@usask.ca`,
    password: "123"
  };
};

testUtils.addRole = function(user) {
  const nUser = JSON.parse(JSON.stringify(user));
  nUser.role = "EXPORTER";
  return nUser;
};

testUtils.addRoleInstructor = function(user) {
  const nUser = JSON.parse(JSON.stringify(user));
  nUser.role = "INSTRUCTOR";
  return nUser;
};

module.exports = testUtils;