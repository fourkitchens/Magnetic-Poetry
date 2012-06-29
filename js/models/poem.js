/**
 * @fileoverview defines the poem model.
 */

var server = false;
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
  server = true;
}

define(function(require, exports, module) {
  var Backbone = require('backbone');

  if (server) {
    var Word = require('./word');
    var SimplePoem = require('./simplePoem');
  }
  else {
    var Word = require('models/word');
    var SimplePoem = require('models/simplePoem');
  }

  /**
   * Type definition for Poem model.
   */
  exports = {
    id: null,
    nid: null,
    status: true,
    breakpoint: '',
    words: Backbone.Collection.extend({
      model: Word
    }),
    parent: null,
    children: Backbone.Collection.extend({
      model: SimplePoem
    })
  };
});

