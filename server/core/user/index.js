const router = require('express').Router();
const userController = require('./controller');
const validator = require('../../middlewares/joi-validate');
const schemas = require('./schemas');

router.post('/register', validator(schemas.register), async(req, res, next) => {
  try {
    await userController.register(req.body.username, req.body.password, req.body.role);
    res.json(req.body.username);
  } catch (err) {
    next(err);
  }
});

router.post('/login', validator(schemas.login), async(req, res, next) => {
  try {
    res.json(await userController.login(req.body.username, req.body.password));
  } catch (err) {
    next(err);
  }
});

module.exports = router;