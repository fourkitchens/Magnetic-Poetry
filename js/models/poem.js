/**
 * @fileoverview defines the poem model.
 */

if (typeof module !== 'undefined') {
  var Backbone = require('../libs/backbone');
  var Word = require('./word');
}
else {
  var Word = window.MagPo.Word;
}

/**
 * Type definition for Poem model.
 */
var Poem = {
  id: null,
  nid: null,
  breakpoint: '',
  words: Backbone.Collection.extend({
    model: Word
  }),
};

if (typeof module === 'undefined') {
  // Set usable defaults.
  if (typeof window.MagPo === 'undefined') {
    window.MagPo = { models: {} };
  }
  else if (typeof window.MagPo.models === 'undefined') {
    window.MagPo.models = {};
  }
  window.MagPo.models.Poem = Poem;
}
else {
  module.exports = Poem;
}

