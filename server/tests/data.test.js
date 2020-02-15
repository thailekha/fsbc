const assert = require('assert');
const request = require('supertest');
const chai = require('chai');
const app = require('../bin/www');
const expect = chai.expect;
const uniqid = require('uniqid');
const statusCodes = require('http-status-codes');
const MongoDBController = require('../core/data/mongodb/mongodb');
const utils = require('../core/utils');
const testUtils = require('./testUtils');

const mongodb = new MongoDBController(process.env.ATLAS_CREDS);

const collectorCreds = 'mongodb://127.0.0.1:27017/test';

describe('user-management', function() {
  before(async() => {
    await mongodb.deleteDocuments();
  });
  it('should register', async() => {
    const user = testUtils.generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(200);
  });
  it('should login', async() => {
    const user = testUtils.generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(200);
    const {body: {token, role}} = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user)
      .expect(200);
    assert.ok(token);
    assert.ok(role);
    expect(token).to.have.lengthOf.above(0);
    assert.equal(role, 'EXPORTER');
  });
  it('should not add duplicate user', async() => {
    const user = testUtils.generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(200);
    const res = await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(statusCodes.CONFLICT);
    assert.equal(res.body.message, 'Email already registered');
  });
  it('should not allow user not exist login', async() => {
    const user = testUtils.generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(200);
    user.username = `wrong-email${user.username}`;
    const res = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user)
      .expect(statusCodes.BAD_REQUEST);
    assert.equal(res.body.message, 'Email is incorrect');
  });
  it('should not allow wrong password login', async() => {
    const user = testUtils.generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(200);
    user.password += 'wrongpassword';
    const res = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user)
      .expect(statusCodes.BAD_REQUEST);
    assert.equal(res.body.message, 'Password is incorrect');
  });
  it('should not allow two instructors', async() => {
    const user1 = testUtils.generateUser();
    const user2 = testUtils.generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRoleInstructor(user1))
      .expect(200);
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRoleInstructor(user2))
      .expect(409);
  });  
  after(async() => {
    await mongodb.deleteDocuments();
  });
});

describe('get-data', async() => {
  it('should get data', async() => {
    const user = testUtils.generateUser();

    const data = {
      coffee: `mocha`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(200);

    const resLogin = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user)
      .expect(200);

    const token = resLogin.body.token;

    const resPost = await request(app)
      .post('/v1/fs')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send(data)
      .expect(200);

    await request(app)
      .get(`/v1/fs/${resPost.body.globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('should not get unexisting data', async() => {
    const user = testUtils.generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(200);
    const resLogin = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user)
      .expect(200);
    const token = resLogin.body.token;
    await request(app)
      .get(`/v1/fs/wrong1234554321`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(statusCodes.NOT_FOUND);
  });
});

describe('all-tasks', async() => {
  it('should register, login, post, get, put, get, trace, get-latest, grant', async() => {
    const user1 = testUtils.generateUser();
    const user2 = testUtils.generateUser();
    const data1 = {
      coffee: `mocha`
    };
    const data2 = {
      coffee: `latte`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user1))
      .expect(200);

    const resLogin1 = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user1)
      .expect(200);

    const resPost = await request(app)
      .post('/v1/fs')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .send(data1)
      .expect(200);
    assert.ok(resPost.body.globalUniqueID);
    expect(resPost.body.globalUniqueID).to.have.lengthOf.above(0);

    const resGet1 = await request(app)
      .get(`/v1/fs/${resPost.body.globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .expect(200);
    assert.deepEqual(resGet1.body.coffee, data1.coffee);

    const resPut = await request(app)
      .put(`/v1/fs/${resPost.body.globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .send(data2)
      .expect(200);
    assert.ok(resPut.body.globalUniqueID);
    expect(resPut.body.globalUniqueID).to.have.lengthOf.above(0);

    const resGet2 = await request(app)
      .get(`/v1/fs/${resPut.body.globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .expect(200);
    assert.deepEqual(resGet2.body.coffee, data2.coffee);

    const resTrace = await request(app)
      .get(`/v1/fs/${resPut.body.globalUniqueID}/trace`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .expect(200);
    assert.ok(resTrace.body[0].coffee);
    assert.ok(resTrace.body[1].coffee);
    assert.equal(resTrace.body[0].coffee, data2.coffee);
    assert.equal(resTrace.body[1].coffee, data1.coffee);

    const resGetLatest = await request(app)
      .get(`/v1/fs/${resPost.body.globalUniqueID}/latest`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .expect(200);
    assert.equal(resPut.body.globalUniqueID, resGetLatest.body.guid);
    assert.deepEqual(resGetLatest.body.data.coffee, data2.coffee);

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user2))
      .expect(200);

    const resLogin2 = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user2)
      .expect(200);

    await request(app)
      .get(`/v1/fs/${resPut.body.globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin2.body.token}`)
      .expect(statusCodes.FORBIDDEN);

    await request(app)
      .put(`/v1/fs/${resPut.body.globalUniqueID}/grant`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .send({grantedUsers: [user2.username]})
      .expect(200);

    console.log(resPut.body.globalUniqueID, resLogin2.body.token);

    const resGetAuthorized = await request(app)
      .get(`/v1/fs/${resPut.body.globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin2.body.token}`)
      .expect(200);
    assert.deepEqual(resGetAuthorized.body.coffee, data2.coffee);
  });
});

describe('get-latest', async() => {
  it('should post 2 data assets, and getAll data', async() => {
    const user1 = testUtils.generateUser();

    const data1 = {
      coffee: `mocha-${uniqid()}`
    };
    const data2 = {
      fruit: `dragonfruit-${uniqid()}`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user1))
      .expect(200);

    const resLogin1 = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user1)
      .expect(200);

    const resPost1 = await request(app)
      .post('/v1/fs')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .send(data1)
      .expect(200);
    assert.ok(resPost1.body.globalUniqueID);
    expect(resPost1.body.globalUniqueID).to.have.lengthOf.above(0);

    const resPost2 = await request(app)
      .post('/v1/fs')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .send(data2)
      .expect(200);
    assert.ok(resPost2.body.globalUniqueID);
    expect(resPost2.body.globalUniqueID).to.have.lengthOf.above(0);

    const resGetAll = await request(app)
      .get(`/v1/fs`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${resLogin1.body.token}`)
      .expect(200);
    assert.equal(resGetAll.body.length, 2);
    assert.deepEqual(resGetAll.body[0].data.fruit, data2.fruit);
    assert.deepEqual(resGetAll.body[1].data.coffee, data1.coffee);
  });

  it('should post 1 data asset, update it, get all data, only 1 asset should be returned', async() => {
    const user = testUtils.generateUser();

    const initialData = {
      coffee: `mocha-${uniqid()}`
    };
    const updatedData = {
      fruit: `dragonfruit-${uniqid()}`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(200);

    const {body: {token}} = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user)
      .expect(200);

    const {body: {globalUniqueID}} = await request(app)
      .post('/v1/fs')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send(initialData)
      .expect(200);
    expect(globalUniqueID).to.have.lengthOf.above(0);

    const {body: {globalUniqueID: nGlobalUniqueID}} = await request(app)
      .put(`/v1/fs/${globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send(updatedData)
      .expect(200);
    expect(nGlobalUniqueID).to.have.lengthOf.above(0);

    const resGetAll = await request(app)
      .get(`/v1/fs`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.equal(resGetAll.body.length, 1);
    assert.deepEqual(resGetAll.body[0].data.fruit, updatedData.fruit);
  });

  it('should post 1 data asset, grant access, other user updates it, both users get all data should only get 1 asset', async() => {
    const user1 = testUtils.generateUser();
    const user2 = testUtils.generateUser();

    const initialData = {
      coffee: `mocha-${uniqid()}`
    };
    const updatedData = {
      fruit: `dragonfruit-${uniqid()}`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user1))
      .expect(200);
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user2))
      .expect(200);

    const {body: {token: token1}} = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user1)
      .expect(200);
    const {body: {token: token2}} = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user2)
      .expect(200);

    const {body: {globalUniqueID: guid}} = await request(app)
      .post('/v1/fs')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .send(initialData)
      .expect(200);

    await request(app)
      .put(`/v1/fs/${guid}/grant`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .send({grantedUsers: [user2.username]})
      .expect(200);

    await request(app)
      .put(`/v1/fs/${guid}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token2}`)
      .send(updatedData)
      .expect(200);

    const {body: allDataForUser1} = await request(app)
      .get(`/v1/fs`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);
    assert.equal(allDataForUser1.length, 1);
    assert.deepEqual(allDataForUser1[0].data.fruit, updatedData.fruit);

    const {body: allDataForUser2} = await request(app)
      .get(`/v1/fs`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    assert.equal(allDataForUser2.length, 1);
    assert.deepEqual(allDataForUser2[0].data.fruit, updatedData.fruit);
  });
});

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// add test for update to the same data

describe('grant-revoke', async() => {
  it('should grant, revoke, and show access', async() => {
    const user1 = testUtils.generateUser();
    const user2 = testUtils.generateUser();
    const data = {
      coffee: `mocha-${uniqid()}`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user1))
      .expect(200);

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user2))
      .expect(200);

    const {body: {token: token1}} = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user1)
      .expect(200);

    const {body: {token: token2}} = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user2)
      .expect(200);

    const {body: {globalUniqueID}} = await request(app)
      .post('/v1/fs')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .send(data)
      .expect(200);

    await request(app)
      .get(`/v1/fs/${globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token2}`)
      .expect(statusCodes.FORBIDDEN);

    const {body: {newGrantedUsers}} = await request(app)
      .put(`/v1/fs/${globalUniqueID}/grant`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .send({grantedUsers: [user2.username]})
      .expect(200);
    assert.deepEqual(newGrantedUsers[0], user2.username);

    const {body: {coffee: resData}} = await request(app)
      .get(`/v1/fs/${globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    assert.deepEqual(resData, data.coffee);

    const {body: {grantedUsers}} = await request(app)
      .get(`/v1/fs/${globalUniqueID}/access`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);
    assert.deepEqual(grantedUsers, [user2.username]);

    await request(app)
      .put(`/v1/fs/${globalUniqueID}/revoke`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .send({userToBeRevoked: user2.username})
      .expect(200);

    await request(app)
      .get(`/v1/fs/${globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token2}`)
      .expect(statusCodes.FORBIDDEN);

    const {body: {grantedUsers: emptyGrantedUsers}} = await request(app)
      .get(`/v1/fs/${globalUniqueID}/access`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);
    expect(emptyGrantedUsers).to.have.lengthOf(0);
  });

  // it('should not grant access to unexisting data', async() => {});
  // it('should not revoke access of unexisting data', async() => {});
  // it('should not revoke access that has not been granted', async() => {});
  // it('should not let owner revoke access of the owner', async() => {});
  // it('should not let other users revoke access of the owner', async() => {});
});

describe('publish-data', async() => {
  beforeEach(async() => {
    await mongodb.deleteDocuments();
  });

  it('should create users including instructor and publish data', async() => {
    const user1 = testUtils.generateUser(); //instructor
    const user2 = testUtils.generateUser();
    const user3 = testUtils.generateUser();
    const data1 = {
      coffee: `mocha-${uniqid()}`
    };

    const tokens = [];

    for (const user of [user1, user2, user3]) {
      await request(app)
        .post('/v1/user/register')
        .set('Content-Type', 'application/json')
        .send(user.username === user1.username ? testUtils.addRoleInstructor(user): testUtils.addRole(user))
        .expect(200);

      const {body: {token}} = await request(app)
        .post('/v1/user/login')
        .set('Content-Type', 'application/json')
        .send(user)
        .expect(200);

      tokens.push(token);
    }

    const [token1, token2, token3] = tokens;

    const {body: {globalUniqueID}} = await request(app)
      .post('/v1/fs/publish')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .send(data1)
      .expect(200);

    const resGet1 = await request(app)
      .get(`/v1/fs/${globalUniqueID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);
    assert.deepEqual(resGet1.body.coffee, data1.coffee);

    const resGet2 = await request(app)
      .get(`/v1/fs`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    assert.deepEqual(resGet2.body[0].data.coffee, data1.coffee);

    const resGet3 = await request(app)
      .get(`/v1/fs`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token3}`)
      .expect(200);
    assert.deepEqual(resGet3.body[0].data.coffee, data1.coffee);
  });

  it('should publish data and retrieve published data', async() => {
    const user1 = testUtils.generateUser(); //instructor
    const data1 = {
      coffee: `mocha`
    };
    const data2 = {
      coffee: `latte`
    };
    const data3 = {
      coffee: `cappu`
    };

    for (const user of [user1, testUtils.generateUser(), testUtils.generateUser(), testUtils.generateUser()]) {
      await request(app)
        .post('/v1/user/register')
        .set('Content-Type', 'application/json')
        .send(user.username === user1.username ? testUtils.addRoleInstructor(user): testUtils.addRole(user))
        .expect(200);
    }

    const {body: {token}} = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user1)
      .expect(200);

    for (const data of [data1, data2, data3]) {
      await request(app)
        .post('/v1/fs/publish')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(data)
        .expect(200);
    }

    const resGetPublished = await request(app)
      .get(`/v1/fs/published`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // latest first
    assert.deepEqual(resGetPublished.body[0].source.data.coffee, data3.coffee);
    assert.deepEqual(resGetPublished.body[1].source.data.coffee, data2.coffee);
    assert.deepEqual(resGetPublished.body[2].source.data.coffee, data1.coffee);

    assert.deepEqual(resGetPublished.body[0].published[0].data.coffee, data3.coffee);
    assert.deepEqual(resGetPublished.body[0].published[1].data.coffee, data3.coffee);
    assert.deepEqual(resGetPublished.body[0].published[2].data.coffee, data3.coffee);

    assert.deepEqual(resGetPublished.body[1].published[0].data.coffee, data2.coffee);
    assert.deepEqual(resGetPublished.body[1].published[1].data.coffee, data2.coffee);
    assert.deepEqual(resGetPublished.body[1].published[2].data.coffee, data2.coffee);

    assert.deepEqual(resGetPublished.body[2].published[0].data.coffee, data1.coffee);
    assert.deepEqual(resGetPublished.body[2].published[1].data.coffee, data1.coffee);
    assert.deepEqual(resGetPublished.body[2].published[2].data.coffee, data1.coffee);
  });

  it('should populate published data for new user', async() => {
    const user1 = testUtils.generateUser(); //instructor
    const user2 = testUtils.generateUser();
    const data1 = {
      coffee: `mocha`
    };
    const data2 = {
      coffee: `latte`
    };
    const data3 = {
      coffee: `cappu`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRoleInstructor(user1))
      .expect(200);

    const {body: {token: token1}} = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user1)
      .expect(200);

    for (const data of [data1, data2, data3]) {
      await request(app)
        .post('/v1/fs/publish')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token1}`)
        .send(data)
        .expect(200);
    }

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user2))
      .expect(200);

    const {body: {token: token2}} = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user2)
      .expect(200);

    const resGetAll = await request(app)
      .get(`/v1/fs`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);

    assert.equal(resGetAll.body.length, 3);
    assert.deepEqual(resGetAll.body[0].data.coffee, data3.coffee);
    assert.deepEqual(resGetAll.body[1].data.coffee, data2.coffee);
    assert.deepEqual(resGetAll.body[2].data.coffee, data1.coffee);
  });
  after(async() => {
    await mongodb.deleteDocuments();
  });
});

describe('collector', async() => {
  beforeEach(async() => {
    await mongodb.deleteDocuments();
  });
  afterEach(async() => {
    await mongodb.deleteDocuments();
  });
  it('3 students 1 data case', async() => {
    const instructor = {
      username: 'i@usask.ca',
      password: 'iii'
    };
    const user1 = {
      username: 'a@usask.ca',
      password: 'aaa'
    };
    const user2 = {
      username: 'b@usask.ca',
      password: 'bbb'
    };
    const user3 = {
      username: 'c@usask.ca',
      password: 'ccc'
    };
    const tokens = [];
    for (const user of [instructor, user1, user2, user3]) {
      await request(app)
        .post('/v1/user/register')
        .set('Content-Type', 'application/json')
        .send(user.username === instructor.username ? testUtils.addRoleInstructor(user) : testUtils.addRole(user))
        .expect(200);

      const {body: {token}} = await request(app)
        .post('/v1/user/login')
        .set('Content-Type', 'application/json')
        .send(user)
        .expect(200);

      tokens.push(token);
    }
    const [token1, token2, token3, token4] = tokens;
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
      await request(app)
        .post('/v1/fs/publish')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token1}`)
        .send(t)
        .expect(200);
    }

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
      "overallStress": 10
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
      "overallStress": 10
    };
    const task1_b = {
      "name": "project1",
      "estimatedHours": "10",
      "notes": "",
      "estimatedStress": 5,
      "regulatedStartDate": 1573581600000,
      "regulatedEndDate": 1573668000000,
      "_dateAdded": 1573598878495,
      "startTime": 1573598869835,
      "endTime": 1573598872999,
      "duration": 3164,
      "stress": 5,
      "comments": "dunno",
      "overallStress": 10
    };
    const task2_b = {
      "name": "project2",
      "estimatedHours": "20",
      "notes": "",
      "estimatedStress": 5,
      "regulatedStartDate": 1573581600000,
      "regulatedEndDate": 1573668000000,
      "_dateAdded": 1573598865886,
      "startTime": 1573598857721,
      "endTime": 1573598859861,
      "duration": 2140,
      "stress": 5,
      "comments": "dunno",
      "overallStress": 10
    };
    const task1_c = {
      "name": "project1",
      "estimatedHours": "10",
      "notes": "",
      "estimatedStress": 5,
      "regulatedStartDate": 1573581600000,
      "regulatedEndDate": 1573668000000,
      "_dateAdded": 1573599105090,
      "startTime": 1573599096654,
      "endTime": 1573599098625,
      "duration": 1971,
      "stress": 5,
      "comments": "dunno",
      "overallStress": 10
    };
    const task2_c = {
      "name": "project2",
      "estimatedHours": "20",
      "notes": "",
      "estimatedStress": 5,
      "regulatedStartDate": 1573581600000,
      "regulatedEndDate": 1573668000000,
      "_dateAdded": 1573599093753,
      "startTime": 1573599085955,
      "endTime": 1573599088130,
      "duration": 2175,
      "stress": 5,
      "comments": "dunno",
      "overallStress": 10
    };

    const doTask1 = [task1_a, task1_b, task1_c];
    const doTask2 = [task2_a, task2_b, task2_c];
    for (const [i, token] of [token2, token3, token4].entries()) {
      // getAll will sort by lastest
      const resGetAll = await request(app)
        .get(`/v1/fs`)
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      assert.equal(resGetAll.body.length, 2);

      const {guid: guidTask2} = resGetAll.body[0];
      const {guid: guidTask1} = resGetAll.body[1];

      // do task 2
      await request(app)
        .put(`/v1/fs/${guidTask2}`)
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(doTask2[i])
        .expect(200);
      // do task 1
      await request(app)
        .put(`/v1/fs/${guidTask1}`)
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(doTask1[i])
        .expect(200);
    }

    const resSources = await request(app)
      .post(`/v1/collector`)
      .set('Content-Type', 'application/json')
      .send({
        link: collectorCreds
      })
      .expect(200);

    const csvTables = [
      {
        "name": "project2",
        "csv": [
          ["Student", "Name", "Estimated Hours", "Notes", "Estimated Stress", "Regulated Start Date", "Regulated End Date", "Start Time", "End Time", "Duration", "Stress scores", "Mean Stress", "Comments", "Overall Stress"],
          ["c@usask.ca", task2.name, task2.estimatedHours, task2.notes, task2.estimatedStress, utils.prettyDate(task2.regulatedStartDate), utils.prettyDate(task2.regulatedEndDate), utils.prettyDate(task2_c.startTime), utils.prettyDate(task2_c.endTime), utils.durationToMinutes(task2_c.duration), 'N/A', task2_c.stress, task2_c.comments, task2_c.overallStress],
          ["b@usask.ca", task2.name, task2.estimatedHours, task2.notes, task2.estimatedStress, utils.prettyDate(task2.regulatedStartDate), utils.prettyDate(task2.regulatedEndDate), utils.prettyDate(task2_b.startTime), utils.prettyDate(task2_b.endTime), utils.durationToMinutes(task2_b.duration), 'N/A', task2_b.stress, task2_b.comments, task2_b.overallStress],
          ["a@usask.ca", task2.name, task2.estimatedHours, task2.notes, task2.estimatedStress, utils.prettyDate(task2.regulatedStartDate), utils.prettyDate(task2.regulatedEndDate), utils.prettyDate(task2_a.startTime), utils.prettyDate(task2_a.endTime), utils.durationToMinutes(task2_a.duration), 'N/A', task2_a.stress, task2_a.comments, task2_a.overallStress],
        ]
      },
      {
        "name": "project1",
        "csv": [
          ["Student", "Name", "Estimated Hours", "Notes", "Estimated Stress", "Regulated Start Date", "Regulated End Date", "Start Time", "End Time", "Duration", "Stress scores", "Mean Stress", "Comments", "Overall Stress"],
          ["c@usask.ca", task1.name, task1.estimatedHours, task1.notes, task1.estimatedStress, utils.prettyDate(task1.regulatedStartDate), utils.prettyDate(task1.regulatedEndDate), utils.prettyDate(task1_c.startTime), utils.prettyDate(task1_c.endTime), utils.durationToMinutes(task1_c.duration), 'N/A', task1_c.stress, task1_c.comments, task1_c.overallStress],
          ["b@usask.ca", task1.name, task1.estimatedHours, task1.notes, task1.estimatedStress, utils.prettyDate(task1.regulatedStartDate), utils.prettyDate(task1.regulatedEndDate), utils.prettyDate(task1_b.startTime), utils.prettyDate(task1_b.endTime), utils.durationToMinutes(task1_b.duration), 'N/A', task1_b.stress, task1_b.comments, task1_b.overallStress],
          ["a@usask.ca", task1.name, task1.estimatedHours, task1.notes, task1.estimatedStress, utils.prettyDate(task1.regulatedStartDate), utils.prettyDate(task1.regulatedEndDate), utils.prettyDate(task1_a.startTime), utils.prettyDate(task1_a.endTime), utils.durationToMinutes(task1_a.duration), 'N/A', task1_a.stress, task1_a.comments, task1_a.overallStress],
        ]
      }
    ];

    assert.deepEqual(resSources.body, csvTables);
  });
  it('incomplete task', async() => {
    const instructor = {
      username: 'i@usask.ca',
      password: 'iii'
    };
    const user1 = {
      username: 'a@usask.ca',
      password: 'aaa'
    };
    const tokens = [];
    for (const user of [instructor, user1]) {
      await request(app)
        .post('/v1/user/register')
        .set('Content-Type', 'application/json')
        .send(user.username === instructor.username ? testUtils.addRoleInstructor(user): testUtils.addRole(user))
        .expect(200);

      const {body: {token}} = await request(app)
        .post('/v1/user/login')
        .set('Content-Type', 'application/json')
        .send(user)
        .expect(200);

      tokens.push(token);
    }
    const [token1, token2] = tokens;
    const task1 = {
      "name": "project1",
      "estimatedHours": "10",
      "notes": "",
      "estimatedStress": 5,
      "regulatedStartDate": 1573581600000,
      "regulatedEndDate": 1573668000000
    };
    await request(app)
      .post('/v1/fs/publish')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .send(task1)
      .expect(200);

    const task1_a = {
      "name": "project1",
      "estimatedHours": "10",
      "notes": "",
      "estimatedStress": 5,
      "regulatedStartDate": 1573581600000,
      "regulatedEndDate": 1573668000000,
      "stresses": [0, 10],
      "stress": 5,
      "comments": ["dunno", "idk"]
    };

    const resGetAll = await request(app)
      .get(`/v1/fs`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    assert.equal(resGetAll.body.length, 1);

    const {guid} = resGetAll.body[0];
    await request(app)
      .put(`/v1/fs/${guid}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token2}`)
      .send(task1_a)
      .expect(200);

    const resSources = await request(app)
      .post(`/v1/collector`)
      .set('Content-Type', 'application/json')
      .send({
        link: collectorCreds
      })
      .expect(200);

    const csvTables = [
      {
        "name": "project1",
        "csv": [
          ["Student", "Name", "Estimated Hours", "Notes", "Estimated Stress", "Regulated Start Date", "Regulated End Date", "Start Time", "End Time", "Duration", "Stress scores", "Mean Stress", "Comments", "Overall Stress"],
          ["a@usask.ca", task1.name, task1.estimatedHours, task1.notes, task1.estimatedStress, utils.prettyDate(task1.regulatedStartDate), utils.prettyDate(task1.regulatedEndDate), "N/A", "N/A", "N/A", task1_a.stresses, task1_a.stress, task1_a.comments, "N/A"],
        ]
      }
    ];

    assert.deepEqual(resSources.body, csvTables);
  });
  it('should not record login when hasnt logged in', async() => {
    const user = testUtils.generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(200);
    const res = await request(app)
      .post(`/v1/collector/logins`)
      .set('Content-Type', 'application/json')
      .send({
        link: collectorCreds
      })
      .expect(200);

    const csvTable = [ 
      [ 'User IDs', 'Logins' ],
      [ user.username, '' ]
    ];
    
    assert.deepEqual(res.body, csvTable);
  });
  it('should record 1 login', async() => {
    const user = testUtils.generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(200);
    await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user)
      .expect(200);

    const res = await request(app)
      .post(`/v1/collector/logins`)
      .set('Content-Type', 'application/json')
      .send({
        link: collectorCreds
      })
      .expect(200);
    const csvTable = [ 
      [ 'User IDs', 'Logins' ],
      [ user.username, '' ]
    ];

    assert.deepEqual(res.body[0], csvTable[0]);
    assert.equal(res.body[1][0], csvTable[1][0]);
    assert.ok(res.body[1][1].length > 0);
    assert.ok(!res.body[1][1].includes(';'));
  });
  it('should record 3 logins', async() => {
    const user = testUtils.generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user))
      .expect(200);
    for(var i = 0; i < 3; i++) {
      await request(app)
        .post('/v1/user/login')
        .set('Content-Type', 'application/json')
        .send(user)
        .expect(200);
    }

    const res = await request(app)
      .post(`/v1/collector/logins`)
      .set('Content-Type', 'application/json')
      .send({
        link: collectorCreds
      })
      .expect(200);
    const csvTable = [ 
      [ 'User IDs', 'Logins' ],
      [ user.username, '' ]
    ];

    assert.deepEqual(res.body[0], csvTable[0]);
    assert.equal(res.body[1][0], csvTable[1][0]);
    assert.ok(res.body[1][1].split(';').length === 3);
  });
  it('should record 3 logins for each of 2 users', async() => {
    const user1 = testUtils.generateUser();
    const user2 = testUtils.generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user1))
      .expect(200);
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(testUtils.addRole(user2))
      .expect(200);
    for(var i = 0; i < 3; i++) {
      await request(app)
        .post('/v1/user/login')
        .set('Content-Type', 'application/json')
        .send(user1)
        .expect(200);
      await request(app)
        .post('/v1/user/login')
        .set('Content-Type', 'application/json')
        .send(user2)
        .expect(200);
    }

    const res = await request(app)
      .post(`/v1/collector/logins`)
      .set('Content-Type', 'application/json')
      .send({
        link: collectorCreds
      })
      .expect(200);
    const csvTable = [ 
      [ 'User IDs', 'Logins' ],
      [ user1.username, '' ],
      [ user2.username, '' ]
    ];

    assert.deepEqual(res.body[0], csvTable[0]);
    assert.equal(res.body[1][0], csvTable[1][0]);
    assert.equal(res.body[2][0], csvTable[2][0]);
    assert.ok(res.body[1][1].split(';').length === 3);
    assert.ok(res.body[2][1].split(';').length === 3);
  });
});

// describe('devtest', async() => {
//   it('logs', async() => {});
// });