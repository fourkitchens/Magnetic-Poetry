/**
 * @fileoverview Word model definition.
 */

var mongoose = require('mongoose');

/**
 * Type definition for Word model.
 */
var Word = require('../../models/word');
Word.id = Number;
Word.vid = Number;
Word.string = String;
Word.top = Number;
Word.left = Number;

exports.WordSchema = new mongoose.Schema(Word);
exports.WordModel = mongoose.model('Word', exports.WordSchema);

