/**
 * @fileoverview defines the poem model.
 */

var mongoose = require('mongoose');

/**
 * Type definition for Poem model.
 */
var Poem = require('../../models/poem');
var Word = require('./word');
var SimplePoem = require('./simplePoem');

// We'll use mongo's buildin _id so remove this.
delete Poem.id;
Poem.nid = Number;
Poem.breakpoint = String;
Poem.words = [ Word.WordSchema ];
Poem.parent = String;
Poem.children = [ SimplePoem.SimplePoemSchema ];

// SERVER SIDE FIELDS:
// Author is only set on the server on purpose since this value lives
// in localStorage on the client.
Poem.author = String;
Poem.changed = Date;

exports.PoemSchema = new mongoose.Schema(Poem);
exports.PoemModel = mongoose.model('Poem', exports.PoemSchema);
