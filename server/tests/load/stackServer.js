const express = require('express');
const request = require('superagent');
const testUtils = require('../testUtils');

const app = express();
const port = 9001;
const URL = process.env.LOAD_URL;

var ready = false;
var creds = {};

const instructor = {
  username: 'i@usask.ca',
  password: 'iii'
};

async function addInstructor() {
  await request
    .post(`${URL}/v1/user/register`)
    .set('Content-Type', 'application/json')
    .send(testUtils.addRoleInstructor(instructor));
  console.log('Registered instructor');
}

async function addStudents() {
  const reqs = [];
  for (var x = 0; x < 20; x++) {
    // Register 50 at a time - atlas only allows 100 connection
    for (var i = 0; i < 50; i++) {
      const student = testUtils.generateUser();
      if (creds[student.username]) {
        throw new Error(`Generated same user ${student.username}`);
      }
      creds[student.username] = student;
      reqs.push(
        request
          .post(`${URL}/v1/user/register`)
          .set('Content-Type', 'application/json')
          .send(testUtils.addRole(student))
      );
    }

    const results = await Promise.all(reqs);
    results.forEach(r => {
      if (r.status >= 201) {
        delete creds[r.body];
      }
    });
    console.log(`Registered ${Object.keys(creds).length} students`);
  }

  creds = Object.values(creds);
}

async function addTasks() {
  const {body: {token}} = await request
    .post(`${URL}/v1/user/login`)
    .set('Content-Type', 'application/json')
    .send(instructor);
  const reqs = [];
  for (var i = 0; i < 15; i++) {
    reqs.push(request
      .post(`${URL}/v1/fs/publish`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({
        "name": `proejct ${i}`,
        "estimatedHours": `${i}`,
        "notes": "",
        "estimatedStress": 5,
        "regulatedStartDate": 1573581600000,
        "regulatedEndDate": 1573668000000,
        "_dateAdded": 1573598486217
      }));
  }
  await Promise.all(reqs);
  console.log('Added tasks');
}

async function setup() {
  await addInstructor();
  // await addStudents();
  await addTasks();
  await addStudents();
  console.log(`Prepared for ${creds.length} students`);
  ready = true;
}

app.get('/ping', (req, res) =>
  (ready ? res.end() : res.status(500).end())
);
app.get('/pop', (req, res) => {
  res.json(creds.pop());
  console.log(`${creds.length} students left`);
});
app.get('/exit', (req, res) => (
  res.end(),
  process.exit()
));

app.listen(port, async() => {
  try {
    await setup();
    console.log(`Stack server port ${port}!`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});