/**
 * @fileoverview collection definitions for MagPo.
 */

// Server side definitions.
if (typeof require !== 'undefined') {
  var Backbone = require('backbone');
  var Word = require('./models').Word;
}
else {
  var Word = window.MagPo.Word;
}

/**
 * Defines the words collection.
 */
var WordCollection = Backbone.Collection.extend({
  model: Word
});

// Export the definitions.
if (typeof exports === 'undefined') {
  var exp = window.MagPo;
}
else {
  var exp = exports;
}
exp.WordCollection = WordCollection;

