/**
 * @fileoverview Handles MagPo-twitter integration.
 */

var crypto = require('crypto');
var http = require('http');
var oauth = require('oauth');
var settings = require('../local');
var url = require('url');
var util = require('util');
var mongoose = require('mongoose');
var TUser = require('../models/user').TUserModel;
var User = require('../models/user').UserModel;

var Twitter = exports;

Twitter.attach = function(options) {
  /**
   * Logs a user into twitter.
   */
  this.login = function(req, res, success) {
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

      var tUser = new TUser();
      tUser.oauth_token = oauth_token;
      tUser.oauth_token_secret = oauth_token_secret;
      tUser.save(function(err) {
        if (err) {
          res.writeHead(500);
          res.end();
          return;
        }
        res.json({
          'location': 'https://api.twitter.com/oauth/authenticate?oauth_token=' + oauth_token,
          'tUser': tUser._id
        });
      });
    });
  };

  /**
   * Verifies a login attempt against Twitter.
   */
  this.loginVerify = function(req, res) {
    var self = this;
    if (typeof req.body.user === 'undefined') {
      res.writeHead(401);
      res.end();
      return;
    }
    TUser.findOne({ _id: req.body.user }, function(err, doc) {
      if (err || doc == null || doc.oauth_token != req.body.oauth_token) {
        console.error(err);
        res.writeHead(401);
        res.end();
        return;
      }

      var oa = new oauth.OAuth(
        self.twitter.request_token_url,
        self.twitter.access_url,
        self.twitter.consumer_key,
        self.twitter.consumer_secret,
        "1.0",
        null,
        'HMAC-SHA1'
      );
      var token = oa.getOAuthAccessToken(
        doc.oauth_token,
        doc.oauth_token_secret,
        req.body.oauth_verifier,
        function(err, oauth_access_token, oauth_access_token_secret, results) {
          // Delete the temporary user record.
          TUser.remove({ _id: doc._id }, function(err) {
            if (err) {
              console.error(err);
              // TODO - figure out how to clean up?
            }
          });

          if (err) {
            res.writeHead(401);
            res.end();
            return;
          }

          User.update(
            {
              access_token: oauth_access_token,
              access_token_secret: oauth_access_token_secret
            },
            { $set: {
              user_id: results.user_id,
              screen_name: results.screen_name,
              access_token: oauth_access_token,
              access_token_secret: oauth_access_token_secret
            }},
            {
              upsert: true
            },
            function(err, count) {
              if (err) {
                console.error(err);
                res.writeHead(401);
                res.end();
                return;
              }
              res.json({ status: 'ok', screen_name: results.screen_name });
            }
          );
        }
      );
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

