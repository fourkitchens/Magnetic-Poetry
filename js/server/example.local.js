/**
 * @fileoverview Settings definitions for MagPo.
 */

module.exports = {
  db: 'mongodb://localhost/magpo',
  port: 3001,
  words: 'http://local.mag.com:8081/magpo/json',
  drupal: {
    endpoint: 'http://local.mag.com:8081/poem_rest/',
    user: 'admin',
    password: 'admin',
  },
  twitter: {
    consumer_key: 'xxx',
    consumer_secret: 'xxx',
    access_token_key: 'xxx',
    access_token_secret: 'xxx',
  },
};
