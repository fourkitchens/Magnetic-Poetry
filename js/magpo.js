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
    var baseUrl = window.location.protocol + '//' + window.location.host +
      window.location.pathname;
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
        url: baseUrl + 'app/save',
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
            window.MagPo.app.router.navigate(model.id, { trigger: false });
          }
          $('#shareURL').text(document.URL);
        },
      });
    }
    else if (model instanceof Poem && method == 'read') {
      $.getJSON(
        baseUrl + 'app/load/' + model.id,
        function(data) {
          if (data.status != 'ok') {
            console.error('Error fetching poem from server.');
            return;
          }
          model.set('nid', data.poem.nid);
          model.words.reset();
          _(data.poem.words).each(function(serverWord) {
            var drawer = window.MagPo.app.drawers[serverWord.vid].model;
            var word = drawer.words.get(serverWord.id);
            model.words.add(word);
            $(word.view.el)
              .appendTo('#fridge')
              .position({
                of: '#fridge',
                my: 'left top',
                at: 'left top',
                offset: serverWord.left + ' ' + serverWord.top
              });
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
      window.MagPo.app.poem.id = id;
      window.MagPo.app.poem.fetch({ id: window.MagPo.app.poem.id });
    },
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
      this.model.view = this;
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
        $(this.el).position({ top: top, left: left });
      }

      return this;
    }
  });

  /**
   * Defines a drawer view.
   */
  var DrawerView = Backbone.View.extend({
    tagName: 'div',
    attributes: {
      class: 'drawer',
      style: 'display: none',
    },
    initialize: function() {
      var self = this;
      self.model.view = self;
      self.model.words.bind('reset', self.addAll, self);
      self.model.words.bind('all', self.render, self);

      $(self.el).droppable({
        drop: function(event, ui) {
          var dropped = $(ui.draggable).data('backbone-view').model;
          window.MagPo.app.poem.words.remove(dropped);
          window.MagPo.app.poemView.render();

          if (dropped.get('vid') == self.model.id) {
            $(ui.draggable).appendTo(self.$el).offset(ui.offset);
          }
          else {
            // Unset the top and left values for this item since its drawer is
            // currently hidden and off the screen.
            $(ui.draggable)
              .appendTo(drawers[dropped.get('vid')].view.$el)
              .css('top', '')
              .css('left', '');
          }
        },
      });
    },
    render: function(){
      $('#drawers').append(this.$el);
    },
    addAll: function() {
      var self = this;
      this.model.words.each(function(word) {
        var wordView = new WordView({
          model: word
        });
        wordView.render();
        if (word.get('top') == null || word.get('left') == null) {
          $(self.el).append(wordView.$el);
        }
      });
    }
  });

  /**
   * Defines the view for the drawer handle.
   */
  var DrawerHandleView = Backbone.View.extend({
    tagName: 'li',
    attributes: {
      class: 'drawer-handle',
    },
    initialize: function() {
      this.render();
    },
    render: function() {
      var self = this;
      $(self.el).html(self.model.get('name'));
      $('#drawer-handles').append(self.$el);
      $(self.el).click(function() {
        // Bail if this handle's drawer is already open.
        if ($(this).hasClass('open-handle')) {
          $(this).removeClass('open-handle');
          $(self.model.view.$el).removeClass('open-drawer').slideUp(400);
          return;
        }
        $('.open-handle').removeClass('open-handle');
        $(this).addClass('open-handle');
        if ($('.open-drawer').length == 1) {
          $('.open-drawer').removeClass('open-drawer').hide()
          $(self.model.view.$el).addClass('open-drawer').show();
        }
        else {
          $(self.model.view.$el).addClass('open-drawer').slideDown(400);
        }
      });
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
      var self = this;
      self.fridgeOffset = $(self.el).offset();

      $(self.el).droppable({
        drop: function(event, ui) {
          var dropped = $(ui.draggable).data('backbone-view').model;
          var dropOffset = ui.offset;
          resultOffset =  {};
          resultOffset.top = dropOffset.top - self.fridgeOffset.top;
          resultOffset.left = dropOffset.left - self.fridgeOffset.left;
          if (!window.MagPo.app.poem.words.get({ id: dropped.id })) {
            // Move the element to the fridge so we can hide the drawer and
            // reset its position relative to the fridge.
            $(ui.draggable)
              .appendTo(self.$el)
              .position({
                of: self.$el,
                my: 'left top',
                at: 'left top',
                offset: resultOffset.left + ' ' + resultOffset.top
              });
            dropped.set('top', resultOffset.top);
            dropped.set('left', resultOffset.left);
            window.MagPo.app.poem.words.add(dropped);
          }
          else {
            dropped.set('top', resultOffset.top);
            dropped.set('left', resultOffset.left);
            window.MagPo.app.poem.words.sort();
          }
          window.MagPo.app.poemView.render();
        },
        out: function(event, ui) {
          var dropped = $(ui.draggable).data('backbone-view').model
          window.MagPo.app.poem.words.remove(dropped);
        },
      });
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
      // Log errors here rather than throwing them since we don't want this
      // functionality to break the rest of the app.
      try {
        var string = window.MagPo.app.poem.stringify(false);
        $(this.el).text(string);
      }
      catch (exception) {
        console.error(exception.message);
      }
    }
  });

  /**
   * Defines the share link view.
   *
   */
  var ShareLinkView = Backbone.View.extend({
    el: $('#shareLink'),
    initialize: function() {
      _.bindAll(this, 'render'); 
      $(this.$el).stop
    },
    events: {
      'click': 'openShareDialog',
    },
    openShareDialog: function(event) {
      event.stopPropagation();

      //Save the poem
      window.MagPo.app.poem.save({
        id: window.MagPo.app.poem.id,
        nid: window.MagPo.app.poem.get('nid'),
        words: window.MagPo.app.poem.getWords(),
      });
      // Create the modal view over the fridge.
      var view = new ShareDialogView();
      var fridgeOffset = $('#fridge').offset();
      view.render().showModal( { x: fridgeOffset.left, y: fridgeOffset.top });
    },
  });

  /**
   * Defines the share dialog view.
   */
  var ShareDialogView = window.ModalView.extend({
    templateHtml:
      '<div id="shareModal">'+
      '<p>Poem Saved!</p>'+
      '<textarea id="poemDialog" rows="2" cols="<%= cols %>"></textarea>' +
      '<p id="shareURL"><%= url %></p>'+
      '<div><p>Tweet This.</p></div>'+
      '</div>',
    defaultOptions: {
      fadeInDuration:150,
      fadeOutDuration:150,
      showCloseButton:true,
      bodyOverflowHidden:false,
      closeImageUrl: "img/close-modal.png",
      closeImageHoverUrl: "img/close-modal-hover.png",
    },
    initialize: function() {
      _.bindAll(this, 'render');

      this.template = _.template( this.templateHtml);
    },
    render: function() {
      var cols = Math.floor($('#fridge').width() / window.MagPo.app.charWidth);
      $(this.el).html( this.template({cols: cols, url: 'saving. . .'}));
      // Log errors here rather than throwing them since we don't want this
      // functionality to break the rest of the app.
      try {
        var string = window.MagPo.app.poem.stringify(false);
        $('#poemDialog', this.el).text(string);
      }
      catch (exception) {
        console.error(exception.message);
        $('#poemDialog', this.el).text('we dun fucked up');
      }
      return this;
    }
  });

  /**
   * Local variables.
   */
  var MagPo = function(drawers) {
    var self = this;
    // TODO - detect the correct breakpoint.
    self.poem = new Poem({ breakpoint: 'desktop' });

    self.fridgeView = new FridgeView({ collection: self.poem });
    self.poemView = new PoemView({ collection: self.poem });
    self.shareLinkView = new ShareLinkView();

    var shown = false;
    self.drawers = {};
    _(drawers).each(function(drawer) {
      var model = new Drawer(drawer);
      var view = new DrawerView({ model: model });
      var handle = new DrawerHandleView({ model: model });

      // Open the first drawer.
      if (!shown) {
        $(handle.el).addClass('open-handle');
        $(view.el).addClass('open-drawer').show();
        shown = true;
      }

      model.words.reset(drawer.words);
      var drawerObj = {
        model: model,
        view: view,
      };
      self.drawers[drawer.id] = drawerObj;
    });

    self.router = null;
  };

  MagPo.prototype.start = function() {
    this.router = new AppRouter();
    Backbone.history.start();
  };

  window.MagPo.class = MagPo;
})(jQuery);

