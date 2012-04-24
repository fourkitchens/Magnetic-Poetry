/**
 * @fileoverview collection definitions for MagPo.
 */

// Server side definitions.
if (typeof require !== 'undefined') {
  var Backbone = require('backbone');
  var Word = require('./models').Word;
  var Poem = require('./models').Poem;
}
else {
  var Word = window.MagPo.Word;
  var Poem = window.MagPo.Poem;
}

/**
 * Defines the words collection.
 */
var WordCollection = Backbone.Collection.extend({
  model: Word
});

/**
 * Defines the listings collection.
 */
var Listings = Backbone.Collection.extend({
  model: Poem
});

// Export the definitions.
if (typeof exports === 'undefined') {
  var exp = window.MagPo;
}
else {
  var exp = exports;
}
exp.WordCollection = WordCollection;
exp.Listings = Listings;

