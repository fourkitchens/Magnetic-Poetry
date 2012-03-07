/**
 * @fileoverview User model definition.
 */

var mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({
  user_id: String,
  screen_name: String,
  oauth_token: String,
  oauth_token_secret: String,
  oauth_verifier: String,
});

exports.UserModel = mongoose.model('User', UserSchema);
