/**
 * @fileoverview User model definition.
 */

var mongoose = require('mongoose');

var TUserSchema = new mongoose.Schema({
  oauth_token: String,
  oauth_token_secret: String,
});

var UserSchema = new mongoose.Schema({
  user_id: String,
  screen_name: String,
  access_token: String,
  access_token_secret: String,
  oauth_verifier: String,
});

exports.TUserModel = mongoose.model('TUser', TUserSchema);
exports.UserModel = mongoose.model('User', UserSchema);
