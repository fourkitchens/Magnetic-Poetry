/**
 * @fileoverview Handles MagPo-twitter integration.
 */

var crypto = require('crypto');
var http = require('http');
var oauth = require('oauth');
var settings = require('../local');
var url = require('url');
var util = require('util');

var Twitter = exports;

Twitter.attach = function(options) {
  /**
   * Logs a user into twitter.
   */
  this.login = function(Req, res, success) {
    var self = this;

    var oa = new oauth.OAuth(
      self.twitter.request_token_url,
      self.twitter.access_url,
      self.twitter.consumer_key,
      self.twitter.consumer_secret,
      "1.0",
      success,
      'HMAC-SHA1'
    );

    var token = oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
      if (error) {
        console.error(util.format('Error %d: %s', error.statusCode, error.data));
        res.writeHead(error.statusCode);
        res.end();
        return;
      }

      res.json(
  { 'Location': 'https://api.twitter.com/oauth/authenticate?oauth_token=' + oauth_token });
      res.end();
    });
  };

};

Twitter.init = function(done) {
  this.twitter = {
    access_url: settings.twitter.access_url,
    authorize_url: settings.twitter.authorize_url,
    request_token_url: settings.twitter.request_token_url,
    consumer_key: settings.twitter.consumer_key,
    consumer_secret: settings.twitter.consumer_secret,
    access_token_key: settings.twitter.access_token_key,
    access_token_secret: settings.twitter.access_token_secret,
  };
  return done();
};

