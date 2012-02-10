(function($){
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
      if (typeof localStorage.MagPo_me !== 'undefined') {
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
        data: JSON.stringify({ poem: model.toJSON() }),
        dataType: 'json',
        type: 'POST',
        success: function(data) {
          if (data.status != 'ok') {
            console.error('Error saving poem to server.');
            return;
          }
          model.id = data.poem.id;
          if (typeof data.poem.author !== 'undefined') {
            localStorage.MagPo_me = data.poem.author;
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
        }
      );
    }
  };

  var AppRouter = Backbone.Router.extend({
    routes: {
      ':id': 'load',
    },
    load: function(id) {
      poem.id = id;
      poem.fetch({ id: poem.id });
    },
  });

  var Word = Backbone.Model.extend({
    defaults: window.MagPo.models.Word,
  });
  var WordView = Backbone.View.extend({
    tagName: 'div',
    attributes: {
      class: 'draggable tiles',
    },
    initilaze: function(){
      _.bindAll(this, 'render', 'attributes');
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

      return this;
    }
  });
  var Drawer = Backbone.Collection.extend({
    model: Word,
  });
  var DrawerView = Backbone.View.extend({
    el: $('#drawers'),

    initialize: function(){
      _.bindAll(this, 'render');

      this.collection = new Drawer();
      this.collection.reset(window.MagPo.words);

      $(this).append(this.collection.each.render);
      this.render();
    },

    appendItem: function(word){
      var wordView = new WordView({
        model: word
      });
      $('.drawer', this.el).append(wordView.render().el);
    },
    render: function(){
      var self = this;
      $(this.el).prepend('<div class="drawer"></div>');
      _(this.collection.models).each(function(item){
        self.appendItem(item);
      }, this);
    }
  });

  var Poem = Backbone.Model.extend({
    defaults: window.MagPo.models.Poem,
    initialize: function() {
      var poemCollection = Backbone.Collection.extend({
        model: Word,
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
  });

  var poem = new Poem();

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
          if (!poem.words.getByCid((dropped.cid))) {
            poem.words.add(dropped);
          }
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

  var PoemView = Backbone.View.extend({
    el: $('#poemText'),
    initialize: function() {
      _.bindAll(this, 'render');

      this.collection.bind('add', this.render, this);
      this.collection.bind('remove', this.render, this);
    },
    render: function() {
      $(this.el).html(
      JSON.stringify(poem.words.pluck('string')));
    }
  });

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

  var router = new AppRouter();
  var drawerView = new DrawerView();
  var fridgeView = new FridgeView({collection:poem});
  var poemView = new PoemView({collection:poem});
  var submitView = new SubmitView();

  Backbone.history.start();
})(jQuery);

