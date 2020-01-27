import http from "k6/http";
import { fail, sleep } from "k6";
// import testUtils from './bundles/testUtils.js';
import uniqid from './bundles/uniqid.js';

const URL = __ENV.LOAD_URL;
const CREDS_SERVER = 'http://localhost:9001';

function checkRes(res, info) {
  if (res.status === 500 && res.body.includes("E11000 duplicate")) {
    return;
  }
  if (res.status >= 300) {
    console.error(`@\n@\n@\n@\n@\n@@@@@@@@@@@@@\n@\n@\nError body ${res.body} #\n#\n#\n#\n#\n#############\n#\n#\n#\n#\n`);
  }
  return res.status === 200 || fail(`${info} ${res.status}`);
}

export const options = {
  vus: 50,
  duration: "1m"
};

export default function() {
  const resPop = http.get(`${CREDS_SERVER}/pop`);
  checkRes(resPop, 'Pop from stack');

  const token = (
    http.post(`${URL}/v1/user/login`, resPop.json())
  ).json('token');

  const auth = {headers: {Authorization: `Bearer ${token}`}};

  const resGetAll = http.get(
    `${URL}/v1/fs`, auth
  ).json();

  const {guid: guidTask2} = resGetAll[0];
  const {guid: guidTask1} = resGetAll[1];

  console.log(`VU: ${__VU}  -  ITER: ${__ITER} - ${guidTask2}`);

  const task1_a = {
    "name": "project1",
    "estimatedHours": "10",
    "notes": "",
    "estimatedStress": 5,
    "regulatedStartDate": 1573581600000,
    "regulatedEndDate": 1573668000000,
    "_dateAdded": 1573598764831,
    "startTime": 1573598757175,
    "endTime": 1573598759195,
    "duration": 2020,
    "stress": 5,
    "comments": "dunno",
    "overallStress": 10,
    "foo": uniqid()
  };
  const task2_a = {
    "name": "project2",
    "estimatedHours": "20",
    "notes": "",
    "estimatedStress": 5,
    "regulatedStartDate": 1573581600000,
    "regulatedEndDate": 1573668000000,
    "_dateAdded": 1573598751012,
    "startTime": 1573598737833,
    "endTime": 1573598741135,
    "duration": 3302,
    "stress": 5,
    "comments": "dunno",
    "overallStress": 10,
    "foo": uniqid()
  };

  const resDoTask2 = http.put(
    `${URL}/v1/fs/${guidTask2}`, task2_a, auth
  );
  checkRes(resDoTask2, `Do task 2 ${guidTask2}`);
  const resDoTask1 = http.put(
    `${URL}/v1/fs/${guidTask1}`, task1_a, auth
  );
  checkRes(resDoTask1, `Do task 1 ${guidTask1}`);
}