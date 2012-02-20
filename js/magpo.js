(function($) {

  /**
   * Defines sync behavior to the backend.
   *
   * @param {string} method
   *   The sync method.
   * @param {object} model
   *   The model object that is being synced.
   */
  Backbone.sync = function(method, model) {
    var baseUrl = window.location.protocol + '//' + window.location.host;
    if (model instanceof Poem && (method == 'create' || method == 'update')) {
      var redirect = false;
      if (model.id == null) {
        redirect = true;
      }
      var body = {
        poem: model.toJSON(),
      };

      // If this is an update we should always be sending along our uuid.
      // TODO - store a cookie if local storage isn't supported?
      if (typeof localStorage.getItem('MagPo_me') !== 'undefined') {
        body.poem.author = localStorage.MagPo_me;
      }
      else {
        // Fork it, baby!
        model.id = null;
        redirect = true;
      }

      // Send to server.
      $.ajax({
        url: baseUrl + '/app/save',
        contentType: 'application/json',
        data: JSON.stringify(body),
        dataType: 'json',
        type: 'POST',
        success: function(data) {
          if (data.status != 'ok') {
            console.error('Error saving poem to server.');
            return;
          }
          model.id = data.poem.id;
          if (typeof data.poem.author !== 'undefined') {
            localStorage.setItem('MagPo_me', data.poem.author);
          }
          if (redirect) {
            router.navigate(model.id, { trigger: false });
          }
        },
      });
    }
    else if (model instanceof Poem && method == 'read') {
      $.getJSON(
        baseUrl + '/app/load/' + model.id,
        function(data) {
          if (data.status != 'ok') {
            console.error('Error fetching poem from server.');
            return;
          }
          model.words.reset(data.poem.words);
          _(data.poem.words).each(function(serverWord) {
            var word = words.get(serverWord.id);
            word.set({ top: serverWord.top, left: serverWord.left });
          });
        }
      );
    }
  };

  /**
   * Defines the application router.
   */
  var AppRouter = Backbone.Router.extend({
    routes: {
      ':id': 'load',
    },
    load: function(id) {
      poem.id = id;
      poem.fetch({ id: poem.id });
    },
  });

  /**
   * Defines the word model.
   *
   * @see models/word.js
   */
  var Word = Backbone.Model.extend({
    defaults: window.MagPo.models.Word,
  });

  /**
   * Defines the words collection.
   */
  var Words = Backbone.Collection.extend({
    model: Word,
  });

  /**
   * Defines a word view.
   */
  var WordView = Backbone.View.extend({
    tagName: 'div',
    attributes: {
      class: 'draggable tiles',
    },
    initialize: function(){
      this.model.bind('change', this.render, this);
    },
    render: function(){
      $(this.el).draggable({stack: '.tiles'});
      $(this.el).data('backbone-view', this);

      $(this.el).html('<span>' + this.model.get('string') + '</span>');

      // add the random tilt.
      rand = Math.floor(Math.random()*2);
      if ( rand == 1 ) {
        $(this.el).css("-webkit-transform", "rotate(-2deg)");
      }

      var top = this.model.get('top');
      var left = this.model.get('left');
      if (top != null && left != null) {
        $(this.el).offset({ top: top, left: left });
      }

      return this;
    }
  });

  /**
   * Defines the global workspace.
   */
  var WorkspaceView = Backbone.View.extend({
    el: $('#workspace'),

    initialize: function(){
      _.bindAll(this, 'render');

      // If this is a new poem we can render everybody.
      if (typeof poem.id !== 'undefined' && poem.id != null) {

      }

      words.bind('reset', this.addAll, this);
      words.bind('all', this.render, this);
      //$('#drawers', this.el).append(words.each.render);
      //this.render();
    },

    appendItem: function(word){
      var wordView = new WordView({
        model: word
      });
      wordView.render();
      if (word.get('top') == null || word.get('left') == null) {
        $('#drawers').append(wordView.$el);
      }
    },
    render: function(){
      $(this.el).prepend('<div class="drawer"></div>');
    },
    addAll: function() {
      words.each(this.appendItem);
    }
  });

  /**
   * Defines the poem model.
   *
   * @see models/poem.js
   */
  var Poem = Backbone.Model.extend({
    defaults: window.MagPo.models.Poem,
    initialize: function() {
      var poemCollection = Backbone.Collection.extend({
        model: Word,
        comparator: function(a, b) {
          var third = rowHeight / 3;
          var aTop = a.get('top');
          var bTop = b.get('top');
          // Sort the collection in a "multi-dimensional" array where:
          if (bTop < (aTop - third)) {
            return 1;
          }
          else if (bTop >= aTop && bTop <= (aTop + rowHeight)) {
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
      this.lowestLeft = false;
    },
    getWords: function() {
      return this.words.toJSON();
    },
    toJSON: function() {
      // TODO - need to do this in a more general way so it always
      // matches the externally defined model.
      return {
        id: this.id,
        words: this.words.toJSON(),
      };
    },
    stringify: function() {
      var out = '';
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
      var lastBottom = false;
      this.words.each(function(word) {
        if (!lastBottom) {
          out += Array(Math.floor((word.get('left') - lowestLeft) / charWidth)).join(' ');
        }
        else if (lastBottom && (word.get('top') > (lastBottom + (rowHeight / 3)))) {
          out += "\r";
          out += Array(Math.floor((word.get('left') - lowestLeft) / charWidth)).join(' ');
          lastRight = false;
        }
        if (lastRight) {
          out += Array(Math.floor((word.get('left') - lastRight) / charWidth)).join(' ');
        }
        out += word.get('string');
        lastRight = word.get('left') + (word.get('string').length * charWidth);
        lastBottom = word.get('top') + rowHeight;
      });

      return out;
    },
  });

  /**
   * Defines the fridge (workspace) view.
   *
   * TODO - rename to PoemView and deprecate existing PoemView?
   */
  var FridgeView = Backbone.View.extend({
    el: $('#fridge'),
    initialize: function() {
      _.bindAll(this, 'render', 'wordDropped');
      this.render();

      var collection = this.collection;

      $(this.el).droppable({
        drop: function(event, ui) {
          var dropped = $(ui.draggable).data('backbone-view').model;
          var pos = $(ui.draggable).position();
          dropped.set('top', pos.top);
          dropped.set('left', pos.left);
          if (!poem.words.get({ id: dropped.id })) {
            poem.words.add(dropped);
          }
          else {
            poem.words.sort();
          }
          poemView.render();
        },
        out: function(event, ui) {
          var dropped = $(ui.draggable).data('backbone-view').model
          poem.words.remove(dropped);
        },
      });
    },
    render: function() {
    },
    wordDropped: function(e, ui) {
    },
  });

  /**
   * Defines the textual representation view of a poem.
   */
  var PoemView = Backbone.View.extend({
    el: $('#poemText'),
    initialize: function() {
      _.bindAll(this, 'render');

      this.collection.bind('add', this.render, this);
      this.collection.bind('remove', this.render, this);
    },
    render: function() {
      $(this.el).text(poem.stringify());
    }
  });

  /**
   * Defines the submit view.
   */
  var SubmitView = Backbone.View.extend({
    el: $('#publish'),
    events: {
      'click': 'savePoem',
    },
    savePoem: function() {
      poem.save({
        id: poem.id,
        words: poem.getWords(),
      });
    },
  });

  /**
   * Local variables.
   */
  var poem = new Poem();
  var words = new Words();

  var workspaceView = new WorkspaceView();
  var fridgeView = new FridgeView({collection:poem});
  var poemView = new PoemView({collection:poem});
  var submitView = new SubmitView();

  words.reset(window.MagPo.words);

  var router = null;

  var rowHeight = $('.tiles').height();
  var span = $('.tiles span');
  var charWidth = (span.width() / span.html().length);


  // Positions behave strangely in webkit browsers if the page isn't fully
  // loaded yet.
  $(window).load(function() {
    router = new AppRouter();
    Backbone.history.start();
  });
})(jQuery);

