const express = require('express');
const request = require('superagent');
const testUtils = require('../testUtils');

const app = express();
const port = 9001;
const URL = 'http://localhost:9000';

var ready = false;
var creds = {};

const instructor = {
  username: 'i@usask.ca',
  password: 'iii'
};

async function addUsers() {
  const reqs = [];
  for (var i = 0; i < 1000; i++) {
    const student = testUtils.generateUser();
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
  creds = Object.values(creds);
  console.log('Registered students');
  await request
    .post(`${URL}/v1/user/register`)
    .set('Content-Type', 'application/json')
    .send(testUtils.addRoleInstructor(instructor));
  console.log('Registered instructor');
}

async function addTasks() {
  const {body: {token}} = await request
    .post(`${URL}/v1/user/login`)
    .set('Content-Type', 'application/json')
    .send(instructor);
  const task1 = {
    "name": "project1",
    "estimatedHours": "10",
    "notes": "",
    "estimatedStress": 5,
    "regulatedStartDate": 1573581600000,
    "regulatedEndDate": 1573668000000,
    "_dateAdded": 1573598464009
  };
  const task2 = {
    "name": "project2",
    "estimatedHours": "20",
    "notes": "",
    "estimatedStress": 5,
    "regulatedStartDate": 1573581600000,
    "regulatedEndDate": 1573668000000,
    "_dateAdded": 1573598486217
  };
  for (const t of [task1, task2]) {
    await request
      .post(`${URL}/v1/fs/publish`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send(t);
  }
  console.log('Added tasks');
}

async function setup() {
  await addUsers();
  await addTasks();
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