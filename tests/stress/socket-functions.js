// ============================================
// Socket.IO Artillery Functions
// Helper for WebSocket stress testing
// ============================================

'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Use the same secret as the server for test tokens
const JWT_SECRET = process.env.JWT_SECRET || 'arena-dev-secret-change-in-production';

module.exports = {
  getTestToken,
};

/**
 * Generate a test JWT token for socket authentication
 * In a real load test, you'd register/login first. This shortcut
 * creates tokens directly for pure socket-layer testing.
 */
function getTestToken(userContext, events, done) {
  const userId = crypto.randomUUID();
  const username = `stress_${crypto.randomBytes(4).toString('hex')}`;

  const token = jwt.sign(
    { userId, username, email: `${username}@test.arena.pro` },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  userContext.vars.token = token;
  userContext.vars.userId = userId;
  userContext.vars.username = username;

  return done();
}
