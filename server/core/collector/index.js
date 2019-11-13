const router = require('express').Router();
const controller = require('./controller');
const validator = require('../../middlewares/joi-validate');
const Joi = require('joi');

const collectorSchema = Joi.object().keys({
  link: Joi.string().min(3).required()
});

router.post('/', validator(collectorSchema), async(req, res, next) => {
  try {
    res.json(await controller.collectAll(req.body.link));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
