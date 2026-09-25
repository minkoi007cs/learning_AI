const handler = require('../apps/api/dist/serverless').default;

module.exports = (req, res) => handler(req, res);
