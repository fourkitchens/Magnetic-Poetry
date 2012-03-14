/**
 * @fileoverview defines the poem model.
 */

if (typeof module !== 'undefined') {
  var Backbone = require('backbone');
  var Word = require('./word');
  var SimplePoem = require('./simplePoem');
}
else {
  var Word = window.MagPo.Word;
  var SimplePoem = window.MagPo.SimplePoem;
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
  parent: null,
  children: Backbone.Collection.extend({
    model: SimplePoem
  })
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

