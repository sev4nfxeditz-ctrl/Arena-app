// ============================================
// Artillery Custom Functions
// Generates unique test users for load testing
// ============================================

'use strict';

const crypto = require('crypto');

module.exports = {
  generateUser,
  generateMove,
  setAuthHeader,
};

/**
 * Generate a unique test user for registration/login scenarios
 */
function generateUser(userContext, events, done) {
  const id = crypto.randomBytes(6).toString('hex');
  userContext.vars.username = `stress_${id}`;
  userContext.vars.email = `stress_${id}@test.arena.pro`;
  userContext.vars.password = `StressTest_${id}!`;
  return done();
}

/**
 * Generate a random move for game scenarios
 */
function generateMove(userContext, events, done) {
  const gameType = userContext.vars.gameType || 'tictactoe';

  if (gameType === 'tictactoe') {
    userContext.vars.move = {
      position: Math.floor(Math.random() * 9),
      to: Math.floor(Math.random() * 9),
    };
  } else if (gameType === 'checkers') {
    userContext.vars.move = {
      from: Math.floor(Math.random() * 32),
      to: Math.floor(Math.random() * 32),
    };
  } else if (gameType === 'chess') {
    const files = 'abcdefgh';
    const from = files[Math.floor(Math.random() * 8)] + (Math.floor(Math.random() * 8) + 1);
    const to = files[Math.floor(Math.random() * 8)] + (Math.floor(Math.random() * 8) + 1);
    userContext.vars.move = { from, to };
  }

  return done();
}

/**
 * Set auth header from captured token
 */
function setAuthHeader(req, userContext, events, done) {
  if (userContext.vars.token) {
    req.headers = req.headers || {};
    req.headers.Authorization = `Bearer ${userContext.vars.token}`;
  }
  return done();
}
