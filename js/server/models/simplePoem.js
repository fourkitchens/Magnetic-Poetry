/**
 * @fileoverview defines the poem model.
 */

var mongoose = require('mongoose');

/**
 * Type definition for Poem model.
 */
var SimplePoem = require('../../models/simplePoem');

SimplePoem.id = String;
SimplePoem.author = String;
SimplePoem.poem = String;
SimplePoem.changed = Date;

exports.SimplePoemSchema = new mongoose.Schema(SimplePoem);
