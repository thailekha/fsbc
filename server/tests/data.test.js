const assert = require('assert');
const request = require('supertest');
const chai = require('chai');
const app = require('../bin/www');
const expect = chai.expect;
const uniqid = require('uniqid');
const statusCodes = require('http-status-codes');
const MongoDBController = require('../core/data/mongodb');

const mongodb = new MongoDBController(null);

// const username = `test-${uniqid()}`;
// const password = "123";
// const role = "EXPORTER";

function generateUser() {
  return {
    username: `test@abc.com.${uniqid()}`,
    password: "123"
  };
}

function addRole(user) {
  const nUser = JSON.parse(JSON.stringify(user));
  nUser.role = "EXPORTER";
  return nUser;
}

function addRoleInstructor(user) {
  const nUser = JSON.parse(JSON.stringify(user));
  nUser.role = "INSTRUCTOR";
  return nUser;
}

describe('user-management', function() {
  before(async() => {
    await mongodb.deleteDocuments();
  });
  it('should register', async() => {
    const user = generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user))
      .expect(200);
  });
  it('should login', async() => {
    const user = generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user))
      .expect(200);
    const {body: {token}} = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user)
      .expect(200);
    assert.ok(token);
    expect(token).to.have.lengthOf.above(0);
  });
  it('should not add duplicate user', async() => {
    const user = generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user))
      .expect(200);
    const res = await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user))
      .expect(statusCodes.CONFLICT);
    assert.equal(res.body.message, 'Email already registered');
  });
  it('should not allow user not exist login', async() => {
    const user = generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user))
      .expect(200);
    user.username += 'wrong-email';
    const res = await request(app)
      .post('/v1/user/login')
      .set('Content-Type', 'application/json')
      .send(user)
      .expect(statusCodes.BAD_REQUEST);
    assert.equal(res.body.message, 'Email is incorrect');
  });
  it('should not allow wrong password login', async() => {
    const user = generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user))
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
    const user1 = generateUser();
    const user2 = generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRoleInstructor(user1))
      .expect(200);
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRoleInstructor(user2))
      .expect(409);
  });
  after(async() => {
    await mongodb.deleteDocuments();
  });
});

describe('get-data', async() => {
  it('should get data', async() => {
    const user = generateUser();

    const data = {
      coffee: `mocha`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user))
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
    const user = generateUser();
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user))
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
    const user1 = generateUser();
    const user2 = generateUser();
    const data1 = {
      coffee: `mocha`
    };
    const data2 = {
      coffee: `latte`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user1))
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
      .send(addRole(user2))
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
    const user1 = generateUser();

    const data1 = {
      coffee: `mocha-${uniqid()}`
    };
    const data2 = {
      fruit: `dragonfruit-${uniqid()}`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user1))
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
    const user = generateUser();

    const initialData = {
      coffee: `mocha-${uniqid()}`
    };
    const updatedData = {
      fruit: `dragonfruit-${uniqid()}`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user))
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
    const user1 = generateUser();
    const user2 = generateUser();

    const initialData = {
      coffee: `mocha-${uniqid()}`
    };
    const updatedData = {
      fruit: `dragonfruit-${uniqid()}`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user1))
      .expect(200);
    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user2))
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

    await timeout(3000);

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
    const user1 = generateUser();
    const user2 = generateUser();
    const data = {
      coffee: `mocha-${uniqid()}`
    };

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user1))
      .expect(200);

    await request(app)
      .post('/v1/user/register')
      .set('Content-Type', 'application/json')
      .send(addRole(user2))
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
    const user1 = generateUser(); //instructor
    const user2 = generateUser();
    const user3 = generateUser();
    const data1 = {
      coffee: `mocha-${uniqid()}`
    };

    const tokens = [];

    for (const user of [user1, user2, user3]) {
      await request(app)
        .post('/v1/user/register')
        .set('Content-Type', 'application/json')
        .send(user.username === user1.username ? addRoleInstructor(user): addRole(user))
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
    const user1 = generateUser(); //instructor
    const data1 = {
      coffee: `mocha`
    };
    const data2 = {
      coffee: `latte`
    };
    const data3 = {
      coffee: `cappu`
    };

    for (const user of [user1, generateUser(), generateUser(), generateUser()]) {
      await request(app)
        .post('/v1/user/register')
        .set('Content-Type', 'application/json')
        .send(user.username === user1.username ? addRoleInstructor(user): addRole(user))
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
    const user1 = generateUser(); //instructor
    const user2 = generateUser();
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
      .send(addRoleInstructor(user1))
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
      .send(addRole(user2))
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

// describe('devtest', async() => {
//   it('logs', async() => {});
// });