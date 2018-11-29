const assert = require('assert');
const request = require('supertest');
const chai = require('chai');
const app = require('../bin/www');
const expect = chai.expect;
const uniqid = require('uniqid');

// const username = `test-${uniqid()}`;
// const password = "123";
// const role = "EXPORTER";

function generateUser() {
  return {
    username: `test-${uniqid()}`,
    password: "123",
    role: "EXPORTER"
  };
}

describe('User management', function() {
  const user = generateUser();
  it('should register', async() => {
    await request(app)
      .post('/data/register')
      .set('Content-Type', 'application/json')
      .send(user)
      .expect(200);
  });
  it('should login', async() => {
    const {body: {token}} = await request(app)
      .post('/data/login')
      .set('Content-Type', 'application/json')
      .send(user)
      .expect(200);
    assert.ok(token);
    expect(token).to.have.lengthOf.above(0);
  });
});

describe('Data management', async() => {
  it('should register, login, post, get, put, get, trace, get-latest, grant', async() => {
    const user1 = generateUser();
    const user2 = generateUser();
    const data1 = {
      coffee: `mocha-${uniqid()}`
    };
    const data2 = {
      coffee: `latte-${uniqid()}`
    };

    await request(app)
      .post('/data/register')
      .set('Content-Type', 'application/json')
      .send(user1)
      .expect(200);

    const resLogin1 = await request(app)
      .post('/data/login')
      .set('Content-Type', 'application/json')
      .send(user1)
      .expect(200);

    const resPost = await request(app)
      .post('/data')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .send(data1)
      .expect(200);
    assert.ok(resPost.body.globalUniqueID);
    expect(resPost.body.globalUniqueID).to.have.lengthOf.above(0);

    const resGet1 = await request(app)
      .get(`/data/${resPost.body.globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .expect(200);
    assert.deepEqual(data1, resGet1.body);

    const resPut = await request(app)
      .put(`/data/${resPost.body.globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .send(data2)
      .expect(200);
    assert.ok(resPut.body.globalUniqueID);
    expect(resPut.body.globalUniqueID).to.have.lengthOf.above(0);

    const resGet2 = await request(app)
      .get(`/data/${resPut.body.globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .expect(200);
    assert.deepEqual(data2, resGet2.body);

    const resTrace = await request(app)
      .get(`/data/${resPut.body.globalUniqueID}/trace`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .expect(200);
    console.log(resTrace.body);
    assert.deepEqual(data2, resTrace.body[0]);
    assert.deepEqual(data1, resTrace.body[1]);

    const resGetLatest = await request(app)
      .get(`/data/${resPost.body.globalUniqueID}/latest`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .expect(200);
    assert.equal(resPut.body.globalUniqueID, resGetLatest.body.latestGlobalUniqueID);
    assert.deepEqual(data2, resGetLatest.body.data);

    await request(app)
      .post('/data/register')
      .set('Content-Type', 'application/json')
      .send(user2)
      .expect(200);

    const resLogin2 = await request(app)
      .post('/data/login')
      .set('Content-Type', 'application/json')
      .send(user2)
      .expect(200);

    await request(app)
      .get(`/data/${resPut.body.globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin2.body.token}`)
      .expect(500);

    await request(app)
      .put(`/data/${resPut.body.globalUniqueID}/grant`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .send({grantedUsers: [user2.username]})
      .expect(200);

    console.log(resPut.body.globalUniqueID, resLogin2.body.token);

    const resGetAuthorized = await request(app)
      .get(`/data/${resPut.body.globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin2.body.token}`)
      .expect(200);
    assert.deepEqual(data2, resGetAuthorized.body);
  });
});