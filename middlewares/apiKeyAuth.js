// middlewares/apiKeyAuth.js
const API_KEYS = new Set([process.env.POWERBI_API_KEY]);

const apiKeyAuth = (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.apikey;
  if (key && API_KEYS.has(key)) {
    req.user = { role: 'service', name: 'powerbi' };
    return next();
  }
  next();
};

module.exports = apiKeyAuth;