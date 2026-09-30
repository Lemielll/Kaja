'use strict';

const { unauthorized } = require('../problem');
const { isValidOpaqueId } = require('../schemas/common');

function requireActorId(req, res, next) {
  if (!req.principal || !isValidOpaqueId(req.principal.actorId)) {
    return unauthorized(res, 'invalid_token');
  }

  return next();
}

module.exports = { requireActorId };