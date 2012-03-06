/**
 * @fileoverview Handles MagPo-twitter integration.
 */

var settings = require('../local');
var twitter = require('ntwitter');
var url = require('url');

var Twitter = exports;

Twitter.attach = function(options) {
  /**
   * Logs a user into twitter.
   */
  this.login = function(req, res, success) {
    var handler = this.twitter.login('/login', success);
    handler(req, res, function(err) {
      if (err) {
        res.writeHead(err);
        res.end();
      }
      res.end();
    });
  };

};

Twitter.init = function(done) {
  this.twitter = new twitter({
    consumer_key: settings.twitter.consumer_key,
    consumer_secret: settings.twitter.consumer_secret,
    access_token_key: settings.twitter.access_token_key,
    access_token_secret: settings.twitter.access_token_secret,
  });
  return done();
};

