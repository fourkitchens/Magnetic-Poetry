/**
 * @fileoverview Defines models for MagPo.
 */

// Server side definitions.
if (typeof require !== 'undefined') {
  var Backbone = require('backbone');
  var wordModel = require('../models/word');
  var poemModel = require('../models/poem');
  var WordCollection = require('./collections').WordCollection;
  var breakpoints = require('../mylibs/breakpoints.js');
}
else {
  var wordModel = window.MagPo.models.Word;
  var poemModel = window.MagPo.models.Poem;
  var WordCollection = window.MagPo.WordCollection;
  var breakpoints = window.MagPo.breakpoints;
}

/**
 * Defines the word model.
 *
 * @see models/word.js
 */
var Word = Backbone.Model.extend({
  defaults: wordModel
});

/**
 * Defines the drawer model.
 */
var Drawer = Backbone.Model.extend({
  attributes: {
    name: 'drawer'
  },
  initialize: function(drawer) {
    this.id = drawer.id;
    this.set('name', drawer.name);
    this.words = new WordCollection();
  }
});

/**
 * Defines the poem model.
 *
 * @see models/poem.js
 */
var Poem = Backbone.Model.extend({
  defaults: poemModel,
  initialize: function() {
    var self = this;
    var poemCollection = WordCollection.extend({
      comparator: function(a, b) {
        var bp = breakpoints[self.get('breakpoint')];
        var third = bp.rowHeight / 3;
        var aTop = a.get('top');
        var bTop = b.get('top');
        // Sort the collection in a "multi-dimensional" array where:
        if (bTop < (aTop - third)) {
          return 1;
        }
        else if (bTop >= (aTop - third) && bTop <= (aTop + bp.rowHeight + third)) {
          if (b.get('left') < a.get('left')) {
            return 1;
          }
          return -1;
        }
        else {
          return -1;
        }
      }
    });
    this.words = new poemCollection();
  },
  getWords: function() {
    return this.words.toJSON();
  },
  stringify: function(simple) {
    var self = this;
    if (typeof simple === 'undefined') {
      simple = true;
    }

    var bp = breakpoints[self.get('breakpoint')];
    var lastRight = false;
    var lastTop = false;
    var lowestLeft = false;
    var out = '';
    var third = bp.rowHeight / 3;

    // Simple stringification uses only single spaces.
    if (simple) {
      this.words.each(function(word) {
        if (
          (lastRight && lastTop) &&
          ((word.get('left') - lastRight) >= bp.charWidth ||
          (word.get('top') > (lastTop + bp.rowHeight + third)))
        ) {
          out += ' ';
        }
        out += word.get('string');
        lastRight = word.get('left') + (word.get('string').length * bp.charWidth);
        lastTop = word.get('top');
      });

      return out;
    }

    // Normal stringification uses spaces and newlines.
    this.words.each(function(word) {
      if (!lowestLeft) {
        lowestLeft = word.get('left');
      }
      else if (word.get('left') < lowestLeft) {
        lowestLeft = word.get('left');
      }
    });
    this.words.each(function(word) {
      if (!lastTop) {
        out += Array(Math.floor((word.get('left') - lowestLeft) / bp.charWidth) + 1)
          .join(' ');
      }
      else if (lastTop && (word.get('top') > (lastTop + bp.rowHeight + third))) {
        out += Array(Math.floor((word.get('top') - lastTop) / bp.rowHeight) + 1).join('\n');
        out += Array(Math.floor((word.get('left') - lowestLeft) / bp.charWidth) + 1).join(' ');
        lastRight = false;
      }
      if (lastRight) {
        var spaces = Math.floor((word.get('left') - lastRight) / bp.charWidth);
        if (spaces <= 0) {
          spaces = 0;
        }
        out += Array(spaces).join(' ');
      }
      out += word.get('string');
      lastRight = word.get('left') + (word.get('string').length * bp.charWidth);
      lastTop = word.get('top');
    });

    return out;
  }
});

// Export the definitions.
if (typeof exports === 'undefined') {
  var exp = window.MagPo;
}
else {
  var exp = exports;
}
exp.Word = Word;
exp.Drawer = Drawer;
exp.Poem = Poem;

