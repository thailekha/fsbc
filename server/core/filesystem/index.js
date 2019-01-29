const router = require('express').Router();
const fsController = require('./controller');
const validator = require('../../middlewares/joi-validate');
const schemas = require('./schemas');

router.get('/', async(req, res, next) => {
  try {
    res.json(await fsController.getAllData(req.username));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async(req, res, next) => {
  try {
    res.json(await fsController.getData(req.params.id, req.username));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/latest', async(req, res, next) => {
  try {
    res.json(await fsController.getLatestData(req.params.id, req.username));
  } catch (err) {
    next(err);
  }
});

router.post('/', validator(schemas.postData), async(req, res, next) => {
  try {
    res.json(await fsController.postData(req.username, req.body));
  } catch (err) {
    next(err);
  }
});

// from ipfs pov, just like post
// from composer pov, ...
router.put('/:id', validator(schemas.putData), async(req, res, next) => {
  try {
    res.json(await fsController.putData(req.params.id, req.username, req.body));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/trace', async(req, res, next) => {
  try {
    res.json(await fsController.trace(req.params.id, req.username));
  } catch (err) {
    next(err);
  }
});

// TODO: endpoint for getting users based on role

router.put('/:id/grant', validator(schemas.grantAccess), async(req, res, next) => {
  try {
    res.json(await fsController.grantAccess(req.params.id, req.username, req.body.grantedUsers));
  } catch (err) {
    next(err);
  }
});

router.put('/:id/revoke', validator(schemas.revokeAccess), async(req, res, next) => {
  try {
    await fsController.revokeAccess(req.params.id, req.username, req.body.userToBeRevoked);
    res.end();
  } catch (err) {
    next(err);
  }
});

router.get('/:id/access', async(req, res, next) => {
  try {
    res.json(await fsController.getAccessInfo(req.params.id, req.username));
  } catch (err) {
    next(err);
  }
});

module.exports = router;