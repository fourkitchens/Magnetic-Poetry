/**
 * @fileoverview defines the poem model.
 */

define(function(require, exports, module) {
  var Backbone = require('backbone');
  var Word = require('models/word');
  var SimplePoem = require('models/simplePoem');

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

