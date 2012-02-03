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
          class: 'draggable tile',
          'data-cid': 'foo',
        },
        initilaze: function(){
          _.bindAll(this, 'render', 'attributes');
        },
        render: function(){
          $(this.el).html('<span>' + this.model.get('string') + '</span>');
          $(this.el).attr('data-cid', this.cid);
          return this;
        }
      });
      var Drawer = Backbone.Collection.extend({
        model: Word,
      });
      var DrawerView = Backbone.View.extend({
        el: $('#container'),

        initialize: function(){
          _.bindAll(this, 'render');

          var collection = this.collection = new Drawer();

          _.each([{string:'this'}, {string:'that'}, {string:'the other'}], function(item){
            collection.create(item)})
          _(this.collection).each(function(item){console.log(item.get('string'))})

          $(this).append(this.collection.each.render);
          console.log(this.collection);
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

      var PoemArenaView = Backbone.View.extend({
        el: $('#droppable'),
        attributes: {
          id: 'PoemArena',
        },
        events: {
          'drop #droppable': 'wordDropped',
        },
        initialize: function() {
          _.bindAll(this, 'render');
          this.render();

          this.collection = new Poem();
        },
        render: function() {
          $(this.el).append('boom');
        },
        wordDropped: function(e, ui) {
        },
      });

      var drawerView = new DrawerView();
      var poemArenaView = new PoemArenaView();
    })(jQuery);

