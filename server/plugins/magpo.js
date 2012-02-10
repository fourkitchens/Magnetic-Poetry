/**
 * @fileoverview Server-side magpo definition.
 */

var mongoose = require('mongoose');
var Word = require('../../models/word');
var Poem = require('../../models/poem');
var settings = require('../local');

var MagPo = exports;

MagPo.name = 'magpo';

MagPo.attach = function() {
  /**
   * Loads a poem by id from persistant storage.
   *
   * @param {string} id
   *  The unique identifier for the poem.
   */
  this.loadPoem = function(id, callback) {
    // TODO - this is fragile, need to think about selecting all EXCEPT
    // the author.
    this.PoemModel.findOne({ _id: id }, ['_id', 'words'], callback);
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

    // TODO - figure out what to do if the author is set but is not the author
    // of the poem they're trying to update!
    // If the id exists and the author is set, try to update.
    if (typeof poem.id !== 'undefined' && poem.id != null && poem.author != null) {
      // TODO - this is fragile and assumes words is all we need to save.
      this.PoemModel.update(
        { _id: poem.id, author: poem.author },
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
    // Else it's a new one!
    else {
      // Generate a unique identifier that will be used to "authenticate" the
      // author. The only time this value is returned (for local storage) is
      // on initial save.
      poemObj.author = require('node-uuid').v4();
      poemObj.save(function(err) {
        if (err) {
          callback(err, null);
        }
        poem.id = poemObj._id.__id;
        poem.author = poemObj.author;
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
    this.PoemModel.remove({ _id: id }, callback);
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
  Poem.words = [ wordSchema ];
  var poemSchema = new mongoose.Schema(Poem);
  this.PoemModel = mongoose.model('Poem', poemSchema);

  return done();
};

MagPo.detach = function() {
  mongoose.connection.close();
};
