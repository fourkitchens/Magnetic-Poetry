(function($){
  // when we want to talk to a server start understanding this.
  Backbone.sync = function(method, model){};
  var Word = Backbone.Model.extend({
    defaults: {
      string: 'hello',
      snap: 'none'
    }
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

      var collection = this.collection = new Drawer();

      _.each([{string:'this'}, {string:'that'}, {string:'the other'}], function(item){
        collection.create(item)})

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

  var Poem = Backbone.Collection.extend({
    model: Word,
  });

  var poem = new Poem;

  var FridgeView = Backbone.View.extend({
    el: $('#fridge'),
    initialize: function() {
      _.bindAll(this, 'render', 'wordDropped');
      this.render();

      var collection = this.collection;

      $(this.el).droppable({
        drop: function(event, ui) {
          var dropped = $(ui.draggable).data('backbone-view').model;
          if (!poem.getByCid((dropped.cid))) {
            poem.add(dropped);
          }
        },
        out: function(event, ui) {
          var dropped = $(ui.draggable).data('backbone-view').model
          poem.remove(dropped);
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
      JSON.stringify(poem.pluck('string')));
    }
  });
  var drawerView = new DrawerView();
  var fridgeView = new FridgeView({collection:poem});
  var poemView = new PoemView({collection:poem});
})(jQuery);

