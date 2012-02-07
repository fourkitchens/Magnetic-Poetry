/**
 * @fileoverview Server-side magpo definition.
 */

var mongoose = require('mongoose');
var Word = require('../../models/word');
var Poem = require('../../models/poem');
var settings = require('../local');

var MagPo = exports;

MagPo.attach = function() {
  /**
   * Loads a poem by id from persistant storage.
   *
   * @param {string} id
   *  The unique identifier for the poem.
   */
  this.loadPoem = function(id, callback) {
  };

  /**
   * Saves a poem to persistant storage.
   *
   * @param {object} poem
   *   A poem object to save to the database.
   */
  this.savePoem = function(poem, callback) {
    var poemObj = new this.PoemModel();
    for (var x = 0; x < poem.words.length; x++) {
      var word = new this.WordModel();
      for (var y in poem.words[x]) {
        word[y] = poem.words[x][y];
      }
      poemObj.words.push(word);
    }

    if (typeof poem.id !== 'unefined') {
      this.PoemModel.update(
        { _id: poem.id },
        { $set: { words: poemObj.words } },
        function(err) {
          if (err) {
            callback(err, null);
            return;
          }
          callback(err, poem);
        }
      );
    }
    else {
      poemObj.save(function(err) {
        if (err) {
          callback(err, null);
        }
        poem.id = poemObj._id;
        callback(err, poem);
      });
    }
  };

  /**
   * Removes a poem from persistant storage.
   *
   * @param {string} id
   *   The unique identifier for the poem.
   */
  this.removePoem = function(id, callback) {
  };
};

MagPo.init = function(done) {
  // Connect to the database.
  mongoose.connect(settings.db);

  // Make database specific changes here.
  var wordSchema = new mongoose.Schema(Word);
  this.WordModel = mongoose.model('Word', wordSchema);

  // We'll use mongo's built in hash ID, so remove it from our internal model.
  delete Poem.id;
  Poem.words = [ this.WordModel ];
  var poemSchema = new mongoose.Schema(Poem);
  this.PoemModel = mongoose.model('Poem', poemSchema);

  return done();
};
