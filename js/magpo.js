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
        },
        initilaze: function(){
          _.bindAll(this, 'render', 'attributes');
        },
        render: function(){
          $(this.el).draggable();
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
        el: $('#container'),

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

      var FridgeView = Backbone.View.extend({
        el: $('#fridge'),
        initialize: function() {
          _.bindAll(this, 'render', 'wordDropped');
          this.render();

          var poem = this.collection = new Poem();

          $(this.el).droppable({
            drop: function(event, ui) {
              //if (!poem.find($(ui.draggable).data('backbone-view').model)) {
                poem.add($(ui.draggable).data('backbone-view').model);
              //}
            },
            out: function(event, ui) {
              poem.remove($(ui.draggable).data('backbone-view').model);
            },
          });
        },
        render: function() {
        },
        wordDropped: function(e, ui) {
        },
      });

      var drawerView = new DrawerView();
      var fridgeView = new FridgeView();
    })(jQuery);

