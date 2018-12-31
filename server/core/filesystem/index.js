const router = require('express').Router();
const fsController = require('./controller');

router.get('/', async(req, res, next) => {
  try {
    res.json(await fsController.getAllData(req.username));
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.get('/:id', async(req, res, next) => {
  try {
    res.json(await fsController.getData(req.params.id, req.username));
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.get('/:id/latest', async(req, res, next) => {
  try {
    res.json(await fsController.getLatestData(req.params.id, req.username));
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.post('/', async(req, res, next) => {
  try {
    res.json(await fsController.postData(req.username, req.body));
  } catch (err) {
    console.log(err);
    next(err);
  }
});

// from ipfs pov, just like post
// from composer pov, ...
router.put('/:id', async(req, res, next) => {
  try {
    res.json(await fsController.putData(req.params.id, req.username, req.body));
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.get('/:id/trace', async(req, res, next) => {
  try {
    res.json(await fsController.trace(req.params.id, req.username));
  } catch (err) {
    console.log(err);
    next(err);
  }
});

// TODO: endpoint for getting users based on role

router.put('/:id/grant', async(req, res, next) => {
  try {
    await fsController.grantAccess(req.params.id, req.username, req.body.grantedUsers);
    res.end();
  } catch (err) {
    console.log(err);
    next(err);
  }
});

module.exports = router;