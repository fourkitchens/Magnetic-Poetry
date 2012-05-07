/**
 * @fileoverview Defines models for MagPo.
 */

// Server side definitions.
if (typeof require !== 'undefined') {
  var Backbone = require('backbone');
  var wordModel = require('../models/word');
  var simplePoemModel = require('../models/simplePoem');
  var poemModel = require('../models/poem');
  var WordCollection = require('./collections').WordCollection;
  var breakpoints = require('../lib/breakpoints.js');
  var u = require('underscore');

  // :( jQuery not used on the server side.
  var jQuery = null;
}
else {
  var wordModel = window.MagPo.models.Word;
  var simplePoemModel = window.MagPo.models.SimplePoem;
  var poemModel = window.MagPo.models.Poem;
  var WordCollection = window.MagPo.WordCollection;
  var breakpoints = window.MagPo.breakpoints;
  var u = _;
}

(function($, _) {
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
 * Defines the simple poem model.
 *
 * @see models/simplePoem.js
 */
var SimplePoem = Backbone.Model.extend({
  defaults: simplePoemModel
});

/**
 * Defines the poem model.
 *
 * @see models/poem.js
 */
var Poem = Backbone.Model.extend({
  defaults: poemModel,
  initialize: function() {
    this.isAuthor = true;
    var PoemCollection = WordCollection.extend({
      comparator: _.bind(this.poemComparator, this)
    });
    this.words = new PoemCollection();

    var ChildrenCollection = Backbone.Collection.extend({
      comparator: _.bind(this.childrenComparator, this)
    });
    this.children = new ChildrenCollection();
  },
  poemComparator: function(a, b) {
    var bp = breakpoints[this.get('breakpoint')];
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
  },
  childrenComparator: function(a, b) {
    if (a.get('changed') > b.get('changed')) {
      return -1;
    }
    else if (a.get('changed') < b.get('changed')) {
      return 1;
    }
    return 0;
  },
  getWords: function() {
    return this.words.toJSON();
  },
  toJSON: function() {
    // TODO - rethink how the ID is set in the model, we shouldn't
    // need to do this.
    var json = _.clone(this.attributes);
    json.id = this.id;
    json.words = this.words.toJSON();
    return json;
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
        out += new Array(Math.floor((word.get('left') - lowestLeft) / bp.charWidth) + 1)
          .join(' ');
      }
      else if (lastTop && (word.get('top') > (lastTop + bp.rowHeight + third))) {
        out += new Array(Math.floor((word.get('top') - lastTop) / bp.rowHeight) + 1).join('\n');
        out += new Array(Math.floor((word.get('left') - lowestLeft) / bp.charWidth) + 1).join(' ');
        lastRight = false;
      }
      if (lastRight) {
        var spaces = Math.floor((word.get('left') - lastRight) / bp.charWidth);
        if (spaces <= 0) {
          spaces = 0;
        }
        out += new Array(spaces).join(' ');
      }
      out += word.get('string');
      lastRight = word.get('left') + (word.get('string').length * bp.charWidth);
      lastTop = word.get('top');
    });

    return out;
  },
  fetch: function(options) {
    this.trigger('fetching');
    var author = localStorage.getItem('MagPo_me');
    $.ajax({
      url: 'app/load/' + this.id,
      contentType: 'application/json',
      data: JSON.stringify({ author: author }),
      dataType: 'json',
      type: 'POST',
      success: _.bind(this.fetchSuccess, this),
      error: _.bind(this.fetchError, this)
    });
  },
  fetchSuccess: function(data) {
    if (data.status !== 'ok') {
      this.trigger('fetchError', data.error);
      console.error('Error fetching poem from server.');
      return;
    }

    // Reset the poem's state if we're loading a different one.
    if (this.id != data.poem.id) {
      // Put the magnets back in their drawers.
      this.words.each(function(word) {
        $(word.view.el).appendTo('#drawer-' + word.get('vid'))
          .css('top', '')
          .css('left', '');
      });
    }

    this.isAuthor = data.author;
    this.set('nid', data.poem.nid);
    this.set('parent', data.poem.parent);
    this.words.reset();
    _(data.poem.words).each(_.bind(function(serverWord) {
      var drawer = window.MagPo.app.drawers[serverWord.vid].model;
      var word = drawer.words.get(serverWord.id);
      this.words.add(word);
      word.set({ top: serverWord.top, left: serverWord.left });
    }, this));
    this.children.reset();
    _(data.poem.children).each(_.bind(function(child) {
      this.children.create(child);
    }, this));

    // Seems the words come back unsorted sometimes so we'll
    // force a sort on load.
    this.words.sort();
    this.children.sort();

    // Perform post loading actions.
    this.trigger('fetchSuccess');
  },
  fetchError: function(jqXHR, textStatus, errorThrown) {
    console.error(textStatus);
    this.trigger('fetchError', jqXHR.status);
  },
  save: function(attributes, options) {
    this.trigger('saving');
    // Invoke the parent save function.
    Backbone.Model.prototype.save.call(this, attributes, options);

    // Now sync with the server.
    var body = {
      poem: this.toJSON()
    };

    // If this is an update we should always be sending along our uuid.
    body.poem.author = localStorage.getItem('MagPo_me');
    if (window.MagPo.app.user) {
      body.poem.author = window.MagPo.app.user;
    }

    // Send to server.
    $.ajax({
      url: 'app/save',
      contentType: 'application/json',
      data: JSON.stringify(body),
      dataType: 'json',
      type: 'POST',
      success: _.bind(this.saveSuccess, this),
      error: _.bind(this.saveError, this)
    });
  },
  saveSuccess: function(data) {
    if (data.status !== 'ok') {
      console.error('Error saving poem to server.');
      this.trigger('saveError', data.status);
      return;
    }
    // It's easier to force a reload on a fork than to modify the existing
    // poem object.
    var trigger = false;
    if (this.id) {
      trigger = true;
    }
    this.id = data.poem.id;
    if (typeof data.poem.author !== 'undefined') {
      localStorage.setItem('MagPo_me', data.poem.author);
    }
    if (data.redirect) {
      // Reset the parent and children.
      this.set('parent', data.poem.parent);
      this.children.reset();

      this.trigger('saveRedirect', trigger);
    }
    this.trigger('saveSuccess', data.status);
  },
  saveError: function(jqXHR, textStatus, errorThrown) {
    console.error(errorThrown);
    this.trigger('saveError', jqXHR.status);
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
}(jQuery, u));

