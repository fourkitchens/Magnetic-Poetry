/**
 * @fileoverview Defines models for MagPo.
 */

// Server side definitions.
if (typeof require !== 'undefined') {
  var Backbone = require('backbone');
  var wordModel = require('../models/word');
  var poemModel = require('../models/poem');
  var WordCollection = requrie('./collections').WordCollection;
}
else {
  var wordModel = window.MagPo.models.Word;
  var poemModel = window.MagPo.models.Poem;
  var WordCollection = window.MagPo.WordCollection;
}

/**
 * Defines the word model.
 *
 * @see models/word.js
 */
var Word = Backbone.Model.extend({
  defaults: wordModel,
});

/**
 * Defines the drawer model.
 */
var Drawer = Backbone.Model.extend({
  attributes: {
    name: 'drawer',
  },
  initialize: function(drawer) {
    this.id = drawer.id;
    this.set('name', drawer.name);
    this.words = new WordCollection();
  },
});

/**
 * Defines the poem model.
 *
 * @see models/poem.js
 */
var Poem = Backbone.Model.extend({
  defaults: poemModel,
  initialize: function() {
    var poemCollection = WordCollection.extend({
      comparator: function(a, b) {
        var third = window.MagPo.app.rowHeight / 3;
        var aTop = a.get('top');
        var bTop = b.get('top');
        // Sort the collection in a "multi-dimensional" array where:
        if (bTop < (aTop - third)) {
          return 1;
        }
        else if (bTop >= (aTop - third) && bTop <= (aTop + window.MagPo.app.rowHeight + third)) {
          if (b.get('left') < a.get('left')) {
            return 1;
          }
          return -1;
        }
        else {
          return -1;
        }
      },
    });
    this.words = new poemCollection();
  },
  getWords: function() {
    return this.words.toJSON();
  },
  toJSON: function() {
    // TODO - need to do this in a more general way so it always
    // matches the externally defined model.
    return {
      id: this.id,
      nid: this.get('nid'),
      words: this.words.toJSON(),
    };
  },
  stringify: function() {
    var out = '';
    var third = window.MagPo.app.rowHeight / 3;
    var lowestLeft = false;
    this.words.each(function(word) {
      if (!lowestLeft) {
        lowestLeft = word.get('left');
      }
      else if (word.get('left') < lowestLeft) {
        lowestLeft = word.get('left');
      }
    });
    var lastRight = false;
    var lastTop = false;
    this.words.each(function(word) {
      if (!lastTop) {
        out += Array(Math.floor((word.get('left') - lowestLeft) / window.MagPo.app.charWidth) + 1).join(' ');
      }
      else if (lastTop && (word.get('top') > (lastTop + window.MagPo.app.rowHeight + third))) {
        out += Array(Math.floor((word.get('top') - lastTop) / window.MagPo.app.rowHeight) + 1).join("\r");
        out += Array(Math.floor((word.get('left') - lowestLeft) / window.MagPo.app.charWidth) + 1).join(' ');
        lastRight = false;
      }
      if (lastRight) {
        var spaces = Math.floor((word.get('left') - lastRight) / window.MagPo.app.charWidth);
        if (spaces <= 0 ) {
          spaces = 0;
        }
        out += Array(spaces).join(' ');
      }
      out += word.get('string');
      lastRight = word.get('left') + (word.get('string').length * window.MagPo.app.charWidth);
      lastTop = word.get('top');
    });

    return out;
  },
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

