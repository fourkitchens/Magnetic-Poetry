/**
 * @fileoverview defines the poem model.
 */

/**
 * Type definition for Poem model.
 */
var Word = require('./word');
var Poem = {
  id: null,
  words: [ Word ],
};

if (typeof module === 'undefined') {
  Poem.words = Backbone.Collection.extend({
    model: Word
  });
  // Set usable defaults.
  if (typeof window['MagPo'] === 'undefined') {
    window.MagPo = { models: {} };
  }
  window.MagPo.models.Poem = Poem;
}
else {
  module.exports = Poem;
}

