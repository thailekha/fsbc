const router = require('express').Router();
const userController = require('./controller');

router.post('/register', async(req, res, next) => {
  try {
    await userController.register(req.body.username, req.body.password, req.body.role);
    res.end();
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.post('/login', async(req, res, next) => {
  try {
    const token = await userController.login(req.body.username, req.body.password);
    res.json({ token });
  } catch (err) {
    console.log(err);
    next(err);
  }
});

module.exports = router;