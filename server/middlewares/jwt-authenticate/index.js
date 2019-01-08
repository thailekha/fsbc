const jwt = require('jsonwebtoken');
const UnauthorizedError = require('./UnauthorizedError');

/**
 * Middleware for authenticating requests based on JSON Web Tokens.
 *
 * @param {object} options - Options for the middleware.
 * @param {string} options.secret - Secret key to use for verifying JSON web token.
 */
module.exports = options => {
  if (!options.secret) {
    throw new Error('Authentication module options.secret parameter is required');
  }

  function middleware(req, res, next) {
    if (!req.headers || !req.headers.authorization) {
      return next(new UnauthorizedError('Authorisation header has not been set'));
    }

    const [schema='', token=''] = req.headers.authorization.split(' ');
    if (schema !== 'Bearer' || !token) {
      return next(new UnauthorizedError('Authorisation header should use "Bearer <token>" schema'));
    }

    jwt.verify(token, options.secret, (err, payload) => {
      if (err || !payload.username) {
        return next(new UnauthorizedError(err.name));
      }
      req.username = payload.username;
      next(null);
    });
  }

  return middleware;
};