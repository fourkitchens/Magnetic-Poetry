/**
 * @fileoverview Server-side magpo definition.
 */

var Poem = require('../models/poem');

var MagPo = exports;

MagPo.attach = function() {
  /**
   * Loads a poem by id from persistant storage.
   *
   * @param {string} id
   *  The unique identifier for the poem.
   */
  this.load = function(id) {
  };

  /**
   * Saves a poem to persistant storage.
   *
   * @param {object} poem
   *   A poem object to save to the database.
   */
  this.save = function(poem) {
  };

  /**
   * Removes a poem from persistant storage.
   *
   * @param {string} id
   *   The unique identifier for the poem.
   */
  this.remove = function(id) {
  };
};

MagPo.init = function(done) {
  return done();
};
