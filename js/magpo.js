(function($) {

  window.MagPo.abstract = {};
  window.MagPo.app = {};

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
  var AppRouter = window.MagPo.abstract.AppRouter = Backbone.Router.extend({
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
  var Word = window.MagPo.abstract.Word = Backbone.Model.extend({
    defaults: window.MagPo.models.Word,
  });

  /**
   * Defines the words collection.
   */
  var WordCollection = window.MagPo.abstract.WordCollection = Backbone.Collection.extend({
    model: Word,
  });

  /**
   * Defines a word view.
   */
  var WordView = window.MagPo.abstract.WordView = Backbone.View.extend({
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

      // If in poem, add to poem dom obj.
      // Else add to appropriate drawer.

      return this;
    }
  });

  /**
   * Defines the drawer model.
   */
  var Drawer = window.MagPo.abstract.Drawer = Backbone.Model.extend({
    attributes: {
      name: 'drawer',
    },
    initialize: function(drawer) {
      this.id = drawer.id;
      this.set('name', drawer.name);
      this.words = new WordCollection();
      this.words.reset(drawer.words);
      _(drawer.words).each(function(word) {
        words.add(word);
      });
    },
  });

  /**
   * Defines a drawer view.
   */
  var DrawerView = window.MagPo.abstract.DrawerView = Backbone.View.extend({
    tagName: 'div',
    attributes: {
      class: 'draggable tiles',
    },
    initialize: function(drawer) {
      this.words = new WordCollection();
    },
    render: function() {
      return this;
    },
  });

  /**
   * Defines the global workspace.
   */
  var WorkspaceView = window.MagPo.abstract.WorkspaceView = Backbone.View.extend({
    el: $('#workspace'),

    initialize: function(){
      _.bindAll(this, 'render');

      // If this is a new poem we can render everybody.
      if (typeof poem.id !== 'undefined' && poem.id != null) {

      }

      words.bind('reset', this.addAll, this);
      words.bind('all', this.render, this);
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
  var Poem = window.MagPo.abstract.Poem = Backbone.Model.extend({
    defaults: window.MagPo.models.Poem,
    initialize: function() {
      var poemCollection = WordCollection.extend({
        comparator: function(a, b) {
          var third = rowHeight / 3;
          var aTop = a.get('top');
          var bTop = b.get('top');
          // Sort the collection in a "multi-dimensional" array where:
          if (bTop < (aTop - third)) {
            return 1;
          }
          else if (bTop >= (aTop - third) && bTop <= (aTop + rowHeight + third)) {
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
        words: this.words.toJSON(),
      };
    },
    stringify: function() {
      var out = '';
      var third = rowHeight / 3;
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
          out += Array(Math.floor((word.get('left') - lowestLeft) / charWidth) + 1).join(' ');
        }
        else if (lastTop && (word.get('top') > (lastTop + rowHeight + third))) {
          out += Array(Math.floor((word.get('top') - lastTop) / rowHeight) + 1).join("\r");
          out += Array(Math.floor((word.get('left') - lowestLeft) / charWidth) + 1).join(' ');
          lastRight = false;
        }
        if (lastRight) {
          var spaces = Math.floor((word.get('left') - lastRight) / charWidth);
          if (spaces <= 0 ) {
            spaces = 0;
          }
          out += Array(spaces).join(' ');
        }
        out += word.get('string');
        lastRight = word.get('left') + (word.get('string').length * charWidth);
        lastTop = word.get('top');
      });

      return out;
    },
  });

  /**
   * Defines the fridge (workspace) view.
   *
   * TODO - rename to PoemView and deprecate existing PoemView?
   */
  var FridgeView = window.MagPo.abstract.FridgeView = Backbone.View.extend({
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
  var PoemView = window.MagPo.abstract.PoemView = Backbone.View.extend({
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
  var SubmitView = window.MagPo.abstract.SubmitView = Backbone.View.extend({
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
  var poem = window.MagPo.app.poem = new Poem();
  var words = window.MagPo.app.words = new WordCollection();

  var workspaceView = window.MagPo.app.workspaceView = new WorkspaceView();
  var fridgeView = window.MagPo.app.fridgeView = new FridgeView({collection:poem});
  var poemView = window.MagPo.app.poemView = new PoemView({collection:poem});
  var submitView = window.MagPo.app.submitView = new SubmitView();

//  words.reset(window.MagPo.words);
  var drawers = window.MagPo.app.drawers = []
  _(window.MagPo.drawers).each(function(drawer) {
    var model = new Drawer(drawer);
    var drawerObj = {
      model: model,
      view: new DrawerView(model),
    };
    drawers.push(drawerObj);
  });

  var router = window.MagPo.app.router = null;

  var rowHeight = window.MagPo.app.rowHeight = $('.tiles').height();
  var span = $('.tiles span');
  //var charWidth = window.MagPo.app.charWidth = (span.width() / span.html().length);


  // Positions behave strangely in webkit browsers if the page isn't fully
  // loaded yet.
  $(window).load(function() {
    router = new AppRouter();
    Backbone.history.start();
  });
})(jQuery);

