(function($) {

  var failedToValidateTxt = "Uh oh! There was a problem validating your poem. Why you trying to hack us, bro?";
  var failedToSaveTxt = 'Uh oh! There was a problem saving your poem. Try again later.';
  var autosave = true;
  var isAuthor = true;

  /**
   * Defines sync behavior to the backend.
   *
   * @param {string} method
   *   The sync method.
   * @param {object} model
   *   The model object that is being synced.
   */
  Backbone.sync = function(method, model) {
    if (model instanceof Poem && (method == 'create' || method == 'update')) {
      var body = {
        poem: model.toJSON()
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
        success: function(data) {
          if (data.status != 'ok') {
            console.error('Error saving poem to server.');
            // Prevent dialogs during autosaves.
            if (!autosave) {
              var dialog = new MessageDialogView({ message: failedToSaveTxt });
              dialog.render().showModal({});
              window.MagPo.app.poem.trigger('saved', data.status);
            }
            return;
          }
          model.id = data.poem.id;
          if (typeof data.poem.author !== 'undefined') {
            localStorage.setItem('MagPo_me', data.poem.author);
          }
          if (data.redirect) {
            // The user just forked the poem, now they're the author.
            if (!isAuthor) {
              isAuthor = true;
            }

            // Reset the parent and children.
            model.set('parent', data.poem.parent);
            model.children.reset();

            // Update the URL and re-render the controls.
            window.MagPo.app.router.navigate(model.id, { trigger: false });
            window.MagPo.app.controlsView.render();
          }
          window.MagPo.app.poem.trigger('saved', data.status);
        },
        error: function(jqXHR, textStatus, errorThrown) {
          console.error(errorThrown);
          // Prevent dialogs during autosaves.
          if (!autosave) {
            var txt = (jqXHR.status == 406) ? failedToValidateTxt : failedToSaveTxt;
            var dialog = new MessageDialogView({ message: txt });
            dialog.render().showModal({});
            window.MagPo.app.poem.trigger('saved', errorThrown);
          }
        }
      });
    }
    else if (model instanceof Poem && method == 'read') {
      var author = localStorage.getItem('MagPo_me');
      $.ajax({
        url: 'app/load/' + model.id,
        contentType: 'application/json',
        data: JSON.stringify({ author: author }),
        dataType: 'json',
        type: 'POST',
        success: function(data) {
          if (data.status != 'ok') {
            console.error('Error fetching poem from server.');
            return;
          }

          // Reset the poem's state if we're loading a different one.
          if (model.id != data.poem.id) {
            // Put the magnets back in their drawers.
            model.words.each(function(word) {
              $(word.view.el).appendTo('#drawer-' + word.get('vid'))
                .css('top', '')
                .css('left', '');
            });
          }

          isAuthor = data.author;
          model.set('nid', data.poem.nid);
          model.set('parent', data.poem.parent);
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
          model.children.reset();
          _(data.poem.children).each(function(child) {
            model.children.create(child);
          });

          // Seems the words come back unsorted sometimes so we'll
          // force a sort on load.
          model.words.sort();
          model.children.sort();

          // Re-render the controls.
          window.MagPo.app.controlsView.render();
        }
      });
    }
  };

  /**
   * Defines the application router.
   */
  var AppRouter = Backbone.Router.extend({
    routes: {
      ':id': 'load'
    },
    load: function(id) {
      window.MagPo.app.poem.id = id;
      window.MagPo.app.poem.fetch({ id: window.MagPo.app.poem.id });
    }
  });

  /**
   * Defines a word view.
   */
  var WordView = Backbone.View.extend({
    tagName: 'div',
    attributes: {
      class: 'draggable tiles'
    },
    initialize: function() {
      this.model.view = this;
      this.model.bind('change', this.render, this);
    },
    render: function() {
      $(this.el)
        .draggable({
          stack: '.tiles'
        });

      $(this.el).data('backbone-view', this);

      $(this.el).html('<span>' + this.model.get('string') + '</span>');

      // add the random tilt.
      rand = Math.floor(Math.random() * 2);
      if (rand == 1) {
        $(this.el).css('-webkit-transform', 'rotate(-2deg)');
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
      style: 'display: none'
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

          // Bail if we're dropping back into the same drawer.
          if ($(ui.draggable).parent().attr('id') === $(self.el).attr('id')) {
            return;
          }

          var siblings = $(ui.draggable).nextAll();
          if (dropped.get('vid') == self.model.id) {
            $(ui.draggable).appendTo(self.$el).offset(ui.offset);
            repositionSiblings(siblings);
          }
          else {
            // Unset the top and left values for this item since its drawer is
            // currently hidden and off the screen.
            $(ui.draggable)
              .appendTo(window.MagPo.app.drawers[dropped.get('vid')].view.$el)
              .css('top', '')
              .css('left', '');
            repositionSiblings(siblings);
          }
        }
      });
    },
    render: function() {
      $(this.el).attr('id', 'drawer-' + this.model.id);
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
      class: 'drawer-handle'
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
          $('.open-drawer').removeClass('open-drawer').hide();
          $(self.model.view.$el).addClass('open-drawer').show();
        }
        else {
          $(self.model.view.$el).addClass('open-drawer').slideDown(400);
        }
      });
    }
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
          resultOffset = {};
          resultOffset.top = dropOffset.top - self.fridgeOffset.top;
          resultOffset.left = dropOffset.left - self.fridgeOffset.left;
          if (!window.MagPo.app.poem.words.get({ id: dropped.id })) {
            // Move the element to the fridge so we can hide the drawer and
            // reset its position relative to the fridge.
            var siblings = $(ui.draggable)
              .appendTo(self.$el)
              .position({
                of: self.$el,
                my: 'left top',
                at: 'left top',
                offset: resultOffset.left + ' ' + resultOffset.top
              }).prevAll();

            repositionSiblings(siblings);

            dropped.set('top', resultOffset.top);
            dropped.set('left', resultOffset.left);
            window.MagPo.app.poem.words.add(dropped);
          }
          else {
            dropped.set('top', resultOffset.top);
            dropped.set('left', resultOffset.left);
            window.MagPo.app.poem.words.sort();
          }

          // If the poem has already been saved once, autosave on drop.
          if (isAuthor && window.MagPo.app.poem.id) {
            if (window.MagPo.app.timeout) {
              clearTimeout(window.MagPo.app.timeout);
            }
            window.MagPo.app.timeout = setTimeout(function() {
              window.MagPo.app.poem.save({
                words: window.MagPo.app.poem.getWords(),
                breakpoint: window.MagPo.app.poem.get('breakpoint')
              });
            }, window.MagPo.app.delay);
          }
          window.MagPo.app.poemView.render();
        },
        out: function(event, ui) {
          var dropped = $(ui.draggable).data('backbone-view').model;
          window.MagPo.app.poem.words.remove(dropped);

          // If the poem has already been saved once, autosave on out.
          if (window.MagPo.app.poem.id) {
            if (window.MagPo.app.timeout) {
              clearTimeout(window.MagPo.app.timeout);
            }
            window.MagPo.app.timeout = setTimeout(function() {
              window.MagPo.app.poem.save({
                words: window.MagPo.app.poem.getWords(),
                breakpoint: window.MagPo.app.poem.get('breakpoint')
              });
            }, window.MagPo.app.delay);
          }
        }
      });
    }
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
      $(this.$el).stop;

      if (!isAuthor) {
        $(this.el).html('Fork');
      }
    },
    events: {
      'click': 'openShareDialog'
    },
    openShareDialog: function(event) {
      autosave = false;
      event.stopPropagation();

      if (!window.MagPo.app.poem.id && !window.MagPo.app.poem.words.length) {
        var dialog = new MessageDialogView({ message: 'Add some words to your poem before sharing!' });
        dialog.render().showModal({});
        return;
      }

      // Stop any autosaves.
      if (window.MagPo.app.timeout) {
        clearTimeout(window.MagPo.app.timeout);
      }

      // Add a listener to show the dialog after saving is complete.
      window.MagPo.app.poem.on('saved', function(msg) {
        if (msg == 'ok') {
          // Create the modal view over the fridge.
          var view = new ShareDialogView();
          var fridgeOffset = $('#fridge').offset();
          view.render().showModal({ x: fridgeOffset.left, y: fridgeOffset.top });

          $('#shareURL').text(document.URL);
          $('#twitterLink').attr('data-url', document.URL);
          var string = window.MagPo.app.poem.stringify(false);
          $('#twitterLink').attr('data-text', string);

          twttr.widgets.load();
        }

        // Remove the listener.
        window.MagPo.app.poem.off('saved');
        autosave = true;
      });

      // Save the poem.
      window.MagPo.app.poem.save({
        words: window.MagPo.app.poem.getWords(),
        breakpoint: window.MagPo.app.poem.get('breakpoint')
      });
    }
  });

  /**
   * Defines the login view.
   */
  var LoginView = Backbone.View.extend({
    el: $('#login'),
    events: {
      'click': 'login',
    },
    login: function(e) {
      var self = this;
      // Save the poem if it hasn't been saved yet so we have a valid
      // return URL.
      if (
        (typeof window.MagPo.app.poem.id === 'undefined' ||
          window.MagPo.app.poem.id === null
        ) &&
        window.MagPo.app.poem.words.length
      ) {
        window.MagPo.app.poem.save();
        window.MagPo.app.poem.on('saved', function() {
          self._login();
          window.MagPo.app.poem.off('saved');
        });
      }
      else {
        self._login();
      }
    },
    _login: function() {
      // First, get a request token.
      $.ajax({
        url: 'app/login',
        contentType: 'application/json',
        data: JSON.stringify({
          success: window.location.toString(),
        }),
        dataType: 'json',
        type: 'POST',
        success: function(data) {
          // TODO - use cookies for people with ancient browsers?
          localStorage.setItem('MagPo_tUser', data.tUser);
          window.location = data.location;
        }
      });
    }
  });

  /**
   * Defines the share dialog view.
   */
  var ShareDialogView = window.ModalView.extend({
    defaultOptions: {
      fadeInDuration: 150,
      fadeOutDuration: 150,
      showCloseButton: true,
      bodyOverflowHidden: false,
      closeImageUrl: 'img/close-modal.png',
      closeImageHoverUrl: 'img/close-modal-hover.png'
    },
    twitterLinkTemplate: _.template($('#twitter-link-template').html()),
    template: _.template($('#share-modal-template').html()),
    render: function() {
      var bp = window.MagPo.breakpoints[window.MagPo.app.poem.get('breakpoint')];
      var cols = Math.floor($('#fridge').width() / bp.charWidth);
      var twitter = {
        related: 'fourkitchens',
        url: document.URL
      };
      var twitterLink = this.twitterLinkTemplate({ twitter: twitter });
      $(this.el).html(this.template({
        cols: cols,
        url: document.URL,
        twitter: twitter,
        twitterLink: twitterLink
      }));

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
   * Defines the message dialog view.
   */
  var MessageDialogView = window.MessageDialogView = window.ModalView.extend({
    defaultOptions: {
      fadeInDuration: 150,
      fadeOutDuration: 150,
      showCloseButton: true,
      bodyOverflowHidden: true,
      closeImageUrl: 'img/close-modal.png',
      closeImageHoverUrl: 'img/close-modal-hover.png'
    },
    template: _.template($('#message-modal-template').html()),
    render: function() {
      var self = this;
      $(self.el).html(
        self.template({
          message: self.options.message
        })
      );

      return self;
    }
  });

  /**
   * Defines the controls view.
   */
  var controlsView = window.ControlsView = Backbone.View.extend({
    el: '#controls',
    events: {
      'click #responses-handle': 'toggleResponses'
    },
    template: _.template($('#controls-template').html()),
    responseTemplate: _.template($('#response-template').html()),
    render: function() {
      var self = this;
      var parent = window.MagPo.app.poem.get('parent');
      var parentLink = false;
      if (parent) {
        parentLink = '#' + parent;
      }
      $(self.el).html(self.template({
        parentLink: parentLink
      }));

      window.MagPo.app.poem.children.each(function(child) {
        $('#responses').append(self.responseTemplate(child.toJSON()));
      });

      if (parent) {
        $('#parent-link').show();
      }
      if (window.MagPo.app.poem.children.length) {
        $('#responses-wrapper').show();
      }
    },
    toggleResponses: function() {
      $('#responses').slideToggle();
    }
  });

  /**
   * Helper function to reset positions of siblings after we move dom
   * elements around.
   *
   * @param {array} siblings
   *   The list of sibling elements to reposition.
   */
  function repositionSiblings(siblings) {
    _(siblings).each(function(sibling) {
      var sModel = $(sibling).data('backbone-view').model;
      $(sibling).position({
        of: '#fridge',
        my: 'left top',
        at: 'left top',
        offset: sModel.get('left') + ' ' + sModel.get('top')
      });
    });
  }

  /**
   * Helper function to get URL query arguments.
   */
  function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.search);

    if (results == null) {
      return "";
    }
    else {
      return decodeURIComponent(results[1].replace(/\+/g, " "));
    }
  }

  /**
   * Local variables.
   */
  var MagPo = function(drawers) {
    var self = this;

    self.timeout = false;
    self.user = false;
    self.delay = 1000;

    // TODO - detect the correct breakpoint.
    self.poem = new Poem({ breakpoint: 'desktop' });

    self.fridgeView = new FridgeView({ collection: self.poem });
    self.poemView = new PoemView({ collection: self.poem });
    self.shareLinkView = new ShareLinkView();
    self.controlsView = new ControlsView();

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
        view: view
      };
      self.drawers[drawer.id] = drawerObj;
    });

    self.login = new LoginView();
    self.login.render();

    self.router = null;
  };

  MagPo.prototype.start = function() {
    var self = this;
    var oauth_token = getParameterByName('oauth_token');
    var oauth_verifier = getParameterByName('oauth_verifier');
    var tUser = localStorage.getItem('MagPo_tUser');
    var user = JSON.parse(localStorage.getItem('MagPo_user'));
    if (oauth_token.length && oauth_verifier.length && tUser) {
      // Remove the query arguments.
      // TODO - detect a hash.
      var path = window.location.pathname;
      if (window.location.hash) {
        path += window.location.hash;
      }
      history.pushState({}, '', path);

      // Send the login information to the back end.
      body = {
        oauth_token: oauth_token,
        oauth_verifier: oauth_verifier,
        user: tUser
      };
      $.ajax({
        url: 'app/login-verify',
        contentType: 'application/json',
        data: JSON.stringify(body),
        dataType: 'json',
        type: 'POST',
        success: function(data) {
          // Go ahead and start the router so the poem is loaded.
          self.startRouter();

          localStorage.removeItem('MagPo_tUser');

          user = {
            id: data.id,
            screen_name: data.screen_name
          };

          localStorage.setItem('MagPo_user', JSON.stringify({
            id: data.id,
            screen_name: data.screen_name
          }));

          // Update any existing poems with the new id.
          var oldId = localStorage.getItem('MagPo_me');
          if (oldId && window.MagPo.app.poem.id) {
            var worker = new Worker('/magpo/js/update.js');
            worker.postMessage({
              callback: window.location.origin + '/magpo/app/update/' + window.MagPo.app.poem.id,
              id: window.MagPo.app.poem.id,
              oldAuthor: oldId,
              newAuthor: data.screen_name
            });
            worker.onmessage = function(event) {
              if (event.data !== 200) {
                console.error(util.format('Error (%d): Error updating poem.'));
              }
            }
          }
          localStorage.setItem('MagPo_me', data.id);

          self.user = user;

          self.loggedIn();
        },
        error: function() {
          localStorage.removeItem('MagPo_tUser');
          // TODO - show an error and start the router?
        }
      });
    }
    else {
      if (user) {
        self.user = user;
        localStorage.setItem('MagPo_me', user.id);
        self.loggedIn();
      }
      self.startRouter();
    }
  };

  /**
   * Updates DOM elements based on the user being logged in.
   */
  MagPo.prototype.loggedIn = function() {
    $('#login').remove();
    $('footer').append('Howdy @' + this.user.screen_name + '!');
  };

  /**
   * Starts the router.
   * NOTE: This can only happen after the window is loaded to avoid
   *  issues with positioning tiles in webkit browsers.
   */
  MagPo.prototype.startRouter = function() {
    this.router = new AppRouter();
    Backbone.history.start();
    $(document).on('touchmove', '.tiles', function(e) {});
  };

  window.MagPo.class = MagPo;
})(jQuery);

