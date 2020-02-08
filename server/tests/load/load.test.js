import http from "k6/http";
import { fail, sleep } from "k6";
// import testUtils from './bundles/testUtils.js';
import uniqid from './bundles/uniqid.js';

const URL = __ENV.LOAD_URL;
const CREDS_SERVER = 'http://localhost:9001';

function checkRes(res, info) {
  //  res.body is string
  if (
    res.status === 500 &&
    (
      res.body.includes("E11000 duplicate") ||
      (
        res.body.includes("guid") && res.body.includes("unique")
      )
    )
  ) {
    return;
  }

  if (res.status >= 300) {
    console.error(`@\n@\n@\n@\n@\n@@@@@@@@@@@@@\n@\n@\nError body ${res.body}\n#\n#\n#\n#\n#############\n#\n#\n#\n#\n`);
  }
  return res.status === 200 || fail(`${info} ${res.status}`);
}

export const options = {
  vus: 300,
  duration: "10m"
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

  // console.log(resGetAll);
  // console.log(`VU: ${__VU}  -  ITER: ${__ITER}`);
  for (const task of resGetAll) {
    task["startTime"] = 1573598757175;
    task["endTime"] = 1573598759195;
    task["duration"] = 2020;
    task["stress"] = 5;
    task["comments"] = "dunno";
    task["overallStress"] = 10;
    task["foo"] = uniqid();

    const resDoTask = http.put(
      `${URL}/v1/fs/${task.guid}`, task, auth
    );
    checkRes(resDoTask, `Do task ${task.guid}`);
  }
}