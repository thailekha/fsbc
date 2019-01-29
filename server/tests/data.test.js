const assert = require('assert');
const request = require('supertest');
const chai = require('chai');
const app = require('../bin/www');
const expect = chai.expect;
const uniqid = require('uniqid');
const statusCodes = require('http-status-codes');

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

describe('User management', function() {
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
});

describe('get data', async() => {
  it('should get data', async() => {
    const user = generateUser();

    const data = {
      coffee: `mocha-${uniqid()}`
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

describe('allTasks', async() => {
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
    assert.deepEqual(resGet2.body, data2);

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
    assert.deepEqual(resGetLatest.body.data, data2);

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
      .expect(statusCodes.NOT_FOUND);

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
    assert.deepEqual(resGetAuthorized.body, data2);
  });
});

describe('getLatest', async() => {
  it('should register, login, post 2 data assets, and getAll data', async() => {
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

  it('should register, login, post 1 data asset, update it, get all data, only 1 asset should be returned', async() => {
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
});

describe('grant, revoke access', async() => {
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
      .expect(statusCodes.NOT_FOUND);

    await request(app)
      .put(`/v1/fs/${globalUniqueID}/grant`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token1}`)
      .send({grantedUsers: [user2.username]})
      .expect(200);

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
      .expect(statusCodes.NOT_FOUND);

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