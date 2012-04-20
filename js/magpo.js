(function($) {

  var failedToValidateTxt = "Uh oh! There was a problem validating your poem. Why you trying to hack us, bro?";
  var failedToSaveTxt = 'Uh oh! There was a problem saving your poem. Find a Web Chef!';
  var failedToLoginTxt = 'Uh oh! There was a problem logging you in. Find a Web Chef!';
  var needToLoginTxt = "Welcome back! If you'd like to be able to edit your poems later you should really log in from the link at the top.";
  var autosave = true;
  var isAuthor = true;
  var barVisible = $('#word-bar').is(':visible');
  var listingsVisible = $('#listings').is(':visible');
  var listingsPage = 0;
  var loadingListings = false;

  var supportsOrientationChange = "onorientationchange" in window;
  var orientationEvent = supportsOrientationChange ? "orientationchange" : "resize";

  // Reset barVisible on orientation changes.
  var dispatch = _.clone(Backbone.Events);
  window.addEventListener(
    orientationEvent,
    function() {
      barVisible = $('#word-bar').is(':visible');
      listingsVisible = $('#listings').is(':visible');
      dispatch.trigger('orientationChange');
    },
    false
  );

  // Event handler for the throbber.
  var throbberEvent = _.clone(Backbone.Events);
  throbberEvent.on('show', function() {
    $('#loading').show();
  });
  throbberEvent.on('hide', function() {
    $('#loading').hide();
  });

  /**
   * Defines sync behavior to the backend.
   *
   * @param {string} method
   *   The sync method.
   * @param {object} model
   *   The model object that is being synced.
   * @param {object} options
   *   Sync options.
   */
  Backbone.sync = function(method, model, options) {
    if (model instanceof Poem && (method === 'create' || method === 'update')) {
      var body = {
        poem: model.toJSON()
      };

      // If this is an update we should always be sending along our uuid.
      body.poem.author = localStorage.getItem('MagPo_me');
      if (window.MagPo.app.user) {
        body.poem.author = window.MagPo.app.user;
      }

      throbberEvent.trigger('show');

      // Send to server.
      $.ajax({
        url: 'app/save',
        contentType: 'application/json',
        data: JSON.stringify(body),
        dataType: 'json',
        type: 'POST',
        success: function(data) {
          throbberEvent.trigger('hide');
          if (data.status !== 'ok') {
            console.error('Error saving poem to server.');
            // Prevent dialogs during autosaves.
            if (!autosave) {
              var dialog = new MessageDialogView({ message: failedToSaveTxt });
              dialog.render().showModal({});
              window.MagPo.app.poem.trigger('saved', data.status);
            }
            return;
          }
          // It's easier to force a reload on a fork than to modify the existing
          // poem object.
          var trigger = false;
          if (model.id) {
            trigger = true;
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

            // Update the URL and perform post loading actions.
            window.MagPo.app.router.navigate(model.id, { trigger: trigger });
            postLoad();
          }
          window.MagPo.app.poem.trigger('saved', data.status);
        },
        error: function(jqXHR, textStatus, errorThrown) {
          throbberEvent.trigger('hide');
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
    else if (model instanceof Poem && method === 'read') {
      throbberEvent.trigger('show');
      var author = localStorage.getItem('MagPo_me');
      $.ajax({
        url: 'app/load/' + model.id,
        contentType: 'application/json',
        data: JSON.stringify({ author: author }),
        dataType: 'json',
        type: 'POST',
        success: function(data) {
          throbberEvent.trigger('hide');
          if (data.status !== 'ok') {
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
            word.set({ top: serverWord.top, left: serverWord.left });
          });
          window.MagPo.app.fridgeView.render();
          model.children.reset();
          _(data.poem.children).each(function(child) {
            model.children.create(child);
          });

          // Seems the words come back unsorted sometimes so we'll
          // force a sort on load.
          model.words.sort();
          model.children.sort();

          // Perform post loading actions.
          postLoad();
        }
      });
    }
    else if (model instanceof Listings && method === 'read') {
      var page = 0;
      if (options.page) {
        page = options.page;
      }
      loadingListings = true;
      throbberEvent.trigger('show');
      $('#listings').append(window.MagPo.app.listingsView.loadingTemplate({}));
      $.ajax({
        url: 'app/list/' + page,
        success: function(data) {
          throbberEvent.trigger('hide');
          _.each(data.poems, function(poem) {
            poem.id = poem._id;
            delete poem._id;
            var poemObj = new Poem(poem);
            _(poem.words).each(function(serverWord) {
              if (!window.MagPo.app.drawers[serverWord.vid]) {
                return;
              }
              var drawer = window.MagPo.app.drawers[serverWord.vid].model;
              var word = drawer.words.get(serverWord.id);
              if (typeof word === 'undefined') {
                return;
              }
              poemObj.words.add(word);
            });
            model.add(poemObj);
          });
          // HACK - leave the page as "loading" if no new poems were returned.
          // This will prevent the pager from continuously increasing.
          if (data.poems.length !== 0) {
            loadingListings = false;
          }
          $('#loading-listings').remove();
        },
        error: function() {
          throbberEvent.trigger('hide');
          loadingListings = false;
          $('#loading-listings').remove();
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
      'class': 'draggable tiles'
    },
    initialize: function() {
      var self = this;
      this.model.view = this;
      this.model.bind('change', this.render, this);

      // Update the helper and start events if necessary.
      dispatch.on('orientationChange', function() {
        if (barVisible) {
          $(self.el).draggable('option', 'helper', self.getHelper());
          // Bind the dragstart/stop if it hasn't been bound yet.
          if (!$(self.el).data('draggable').options.start || !$(self.el).data('draggable').options.stop) {
            $(self.el).draggable('option', 'start', _.bind(self.dragstart, self));
            $(self.el).draggable('option', 'stop', _.bind(self.dragstop, self));
          }
        }
        else {
          $(self.el).draggable('option', 'helper', 'original');
        }
      });
    },
    render: function() {
      var draggable = {
        stack: '.tiles'
      };

      // These options are only needed for mobile devices.
      if (barVisible) {
        draggable.helper = this.getHelper();
        draggable.start = _.bind(this.dragstart, this);
        draggable.stop = _.bind(this.dragstop, this);
      }

      $(this.el).draggable(draggable);
      $(this.el).data('backbone-view', this);

      $(this.el).html('<span>' + this.model.get('string') + '</span>');

      // add the random tilt.
      var rand = Math.floor(Math.random() * 2);
      if (rand === 1) {
        $(this.el).css('-webkit-transform', 'rotate(-2deg)');
      }
      var top = this.model.get('top');
      var left = this.model.get('left');
      if (top != null && left != null) {
        $(this.el).position({ top: top, left: left });
      }

      return this;
    },
    dragstart: function(event, ui) {
      // Check barVisible again in case of an orientation change.
      if (!barVisible) {
        return;
      }
      // Only do this if the word is in a drawer.
      if (event.target.parentElement.id !== 'fridge') {
        window.MagPo.app.wordBarView.toggleBar();
      }
      else {
        // Store the original z-index and increase it to 1000.
        this.zIndex = $(event.target).css('z-index');
        $(event.target).css({ 'z-index': 1000 });
      }
    },
    dragstop: function(event, ui) {
      if (!barVisible || !this.zIndex) {
        return;
      }
      // Reset the z-index to the value it was before the drag started.
      $(event.target).css({ 'z-index': this.zIndex });
      delete this.zIndex;
    },
    getHelper: function() {
      if ($(this.el).parent().attr('id') === 'fridge') {
        return 'original';
      }
      return function(event) {
        // TODO - figure out why adding the tiles class to this completely blows
        // up and makes everything look wrong.
        return $(event.target)
          .clone()
          .css({
            'z-index': 1000,
            'background': 'white',
            'padding': '2px 6px 2px 6px',
            '-webkit-box-shadow': '2px 2px 0px 0px #666',
            '-moz-box-shadow': '2px 2px 0px 0px #666',
            'box-shadow': '2px 2px 0px 0px #666',
            'font-size': '.9em'
          })
          .appendTo('#fridge');
      };
    }
  });

  /**
   * Defines a drawer view.
   */
  var DrawerView = Backbone.View.extend({
    tagName: 'div',
    attributes: {
      'class': 'drawer',
      style: 'display: none'
    },
    initialize: function() {
      var self = this;
      self.model.view = self;
      self.model.words.bind('reset', self.addAll, self);
      self.model.words.bind('all', self.render, self);

      $(self.el).droppable({
        accept: '.tiles',
        drop: function(event, ui) {
          // We only need to do this on mobile devices.
          if (barVisible) {
            $(ui.draggable).draggable('option', 'helper', $(ui.draggable).data('backbone-view').getHelper());
          }
          var dropped = $(ui.draggable).data('backbone-view').model;
          window.MagPo.app.poem.words.remove(dropped);

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

      dispatch.on('orientationChange', function() {
        if (barVisible) {
          var height = ($(window).height() - $('#word-bar').height() - $('#drawer-container').height());
          $(self.el).css('height', height);
        }
      });
    },
    render: function() {
      $(this.el).attr('id', 'drawer-' + this.model.id);
      $('#drawers').append(this.$el);
      this.setHeight();
    },
    setHeight: function() {
      if (barVisible) {
        var height = ($(window).height() - $('#word-bar').height() - $('#drawer-container').height());
        $(this.el).css('height', height);
      }
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
      'class': 'drawer-handle'
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
          return;
        }
        $('.open-handle').removeClass('open-handle');
        $(this).addClass('open-handle');
        if ($('.open-drawer').length === 1) {
          $('.open-drawer').removeClass('open-drawer').hide();
          $(self.model.view.$el).addClass('open-drawer').show();
        }
      });
    }
  });
  /**
   * Defines the moving "word-bar" panel.
   */
  var WordBarView = Backbone.View.extend({
    el: $('#drawers-container'),
    events: {
      'click #word-bar-handle': 'toggleBar'
    },
    initialize: function() {
      var self = this;
      var height = ($(window).height() - $('#word-bar').height());
      self.hiddenHeight = height * -1;
      self.render();

      dispatch.on('orientationChange', function() {
        var height = ($(window).height() - $('#word-bar').height());
        self.hiddenHeight = (height * -1);
        // Resize the drawers according to the current state.
        if (!barVisible) {
          $('#drawers-container').css({
            height: '300px',
            top: '0px'
          });
        }
        else if (barVisible) {
          self.render();
        }
      });
    },
    render: function() {
      if (barVisible) {
        var self = this;
        var height = ($(window).height() - $('#word-bar').height());
        $('#drawers-container').css({
          height: height,
          top: self.hiddenHeight
        });
        $('#word-bar-handle').droppable({
          accept: '.tiles',
          over: function (event, ui) {
            $('#word-bar-handle').text('x remove x');
          },
          out: function (event, ui) {
            $('#word-bar-handle').text('^ words ^');
          },
          drop: function(event, ui) {
            $('#word-bar-handle').text('^ words ^');
            var dropped = $(ui.draggable).data('backbone-view').model;
            window.MagPo.app.poem.words.remove(dropped);

            var siblings = $(ui.draggable).nextAll();
            // Unset the top and left values for this item since its drawer is
            // currently hidden and off the screen.
            $(ui.draggable)
              .appendTo(window.MagPo.app.drawers[dropped.get('vid')].view.$el)
              .css('top', '')
              .css('left', '')
              .draggable(
                'option',
                'helper',
                $(ui.draggable).data('backbone-view').getHelper()
              );
            repositionSiblings(siblings);
          }
        });
      }
    },
    toggleBar: function() {
      var self = this;
      if ($('#drawers-container').hasClass('down')) {
        $('#word-bar-handle').text('^ words ^');
        $('#drawers-container').css('top', self.hiddenHeight);
      }
      else {
        $('#word-bar-handle').text('v poem v');
        $('#drawers-container').css('top', 0);
      }
      $('#drawers-container').toggleClass('down');
    }
  });

  /**
   * Defines a view that is shared by various representations of the poem.
   */
  var PoemView = Backbone.View.extend({
    render: function(breakpoint) {
      if (typeof breakpoint === 'undefined') {
        breakpoint = 'desktop';
      }
      this.collection.words.each(function(word) {
        $(word.view.el)
          .appendTo('#fridge')
          .position({
            of: '#fridge',
            my: 'left top',
            at: 'left top',
            offset: word.get('left') + ' ' + word.get('top')
          });
      });
      return this;
    }
  });

  /**
   * Defines the fridge (workspace) view.
   *
   * TODO - rename to PoemView and deprecate existing PoemView?
   */
  var FridgeView = PoemView.extend({
    el: $('#fridge'),
    initialize: function() {
      var self = this;
      
      $(self.el).droppable({
        accept: '.tiles',
        drop: function(event, ui) {
          // We only need to do this on mobile devices.
          if (barVisible) {
            $(ui.draggable).draggable('option', 'helper', $(ui.draggable).data('backbone-view').getHelper());
          }
          var fridgeOffset = $(self.el).offset();
          var dropped = $(ui.draggable).data('backbone-view').model;
          var dropOffset = ui.offset;
          var resultOffset = {};
          resultOffset.top = dropOffset.top - fridgeOffset.top;
          resultOffset.left = dropOffset.left - fridgeOffset.left;
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
    },
  });


  /**
   * Defines the share link view.
   *
   */
  var ShareLinkView = Backbone.View.extend({
    el: $('#shareLink'),
    events: {
      'click': 'openShareDialog'
    },
    render: function() {
      if (!isAuthor) {
        // If the user isn't logged in, we're going to prevent forks.
        if (window.MagPo.app.user) {
          $(this.el).html('Respond');
        }
        else {
          $(this.el).html('Login to respond');
        }
      }
      else if (!window.MagPo.app.poem.id) {
        $(this.el).html('Share');
      }
      else {
        $(this.el).html('Share changes');
      }
    },
    openShareDialog: function(event) {
      autosave = false;
      event.stopPropagation();

      if (!window.MagPo.app.poem.id && !window.MagPo.app.poem.words.length) {
        var dialog = new MessageDialogView({ message: 'Add some words to your poem before sharing!' });
        dialog.render().showModal({});
        return;
      }

      // If the user isn't logged in, bail on this, and log them in.
      // The poem will be saved in its current state and updated when
      // we get back.
      if (!isAuthor && !window.MagPo.app.user) {
        // Store the poem in local storage,
        // we'll save it to the database when login is complete.
        localStorage.setItem('MagPo_poem', JSON.stringify(window.MagPo.app.poem.toJSON()));
        window.MagPo.app.authView._login();
        return;
      }

      // Stop any autosaves.
      if (window.MagPo.app.timeout) {
        clearTimeout(window.MagPo.app.timeout);
      }

      // Add a listener to show the dialog after saving is complete.
      window.MagPo.app.poem.on('saved', function(msg) {
        if (msg === 'ok') {
          // Create the modal view over the fridge.
          var view = new ShareDialogView();
          var fridgeOffset = $('#fridge').offset();
          view.render().showModal({ x: fridgeOffset.left, y: fridgeOffset.top });
          twttr.widgets.load();

          if (!window.MagPo.app.user) {
            $('#loginInfo').show();
          }
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
   * Defines the share dialog view.
   */
  var ShareDialogView = window.ModalView.extend({
    defaultOptions: {
      fadeInDuration: 150,
      fadeOutDuration: 150,
      showCloseButton: true,
      bodyOverflowHidden: false
    },
    events: {
      'click #loginModal': 'login'
    },
    twitterLinkTemplate: _.template($('#twitter-link-template').html()),
    template: _.template($('#share-modal-template').html()),
    render: function() {
      // Log errors here rather than throwing them since we don't want this
      // functionality to break the rest of the app.
      var string = '';
      try {
        string = window.MagPo.app.poem.stringify();
      }
      catch (exception) {
        console.error(exception.message);
      }

      var twitter = {
        related: 'fourkitchens',
        url: document.URL
      };
      var twitterLink = this.twitterLinkTemplate({ twitter: twitter, string: string });

      $(this.el).html(this.template({
        url: document.URL,
        twitter: twitter,
        twitterLink: twitterLink
      }));

      return this;
    },
    login: function() {
      window.MagPo.app.authView._login();
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
    events: {
      'click a': 'hideModal'
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
  var ControlsView = window.ControlsView = Backbone.View.extend({
    el: 'menu ul',
    events: {
      'click #login-menu': 'toggleLogin',
      'click #shareLinkMenu': 'openShareDialog',
      'click #responses-handle': 'showResponses'
    },
    avatarTemplate: _.template($('#avatar-template').html()),
    menuResponseTemplate: _.template($('#menu-response-template').html()),
    responseTemplate: _.template($('#response-template').html()),
    initialize: function() {
      dispatch.on('orientationChange', function() {
        if (barVisible && $('menu').parent().attr('id') !== 'word-bar') {
          $('menu').prependTo('#word-bar');
        }
        else if (!barVisible && $('menu').parent().attr('id') === 'word-bar') {
          $('menu').prependTo('body');
        }
      });
    },
    render: function() {
      var self = this;
      $('#responses-handle').hide();
      if (window.MagPo.app.poem.children.length || window.MagPo.app.poem.get('parent')) {
        $('#responses-handle').show();
      }

      // Move the menu into the word-bar on mobile devices.
      if (barVisible) {
        $('menu').prependTo('#word-bar');
      }

      if (window.MagPo.app.user) {
        $('#login-menu')
          .html(self.avatarTemplate({ user: window.MagPo.app.user.screen_name }))
          .addClass('logged-in');
      }
    },
    toggleLogin: function(e) {
      if (window.MagPo.app.user) {
        window.MagPo.app.authView.logout();
        $('#login-menu').toggleClass('logged-in').text('Login');
      }
      else {
        window.MagPo.app.authView.login();
        $('#login-menu')
          .html(avatarTemplate({ user: window.MagPo.app.user.screen_name }))
          .toggleClass('logged-in');
      }
    },
    showResponses: function(event) {
      var self = this;
      var responses = '';
      var parent = window.MagPo.app.poem.get('parent');
      var parentLink = false;

      event.stopPropagation();

      if (parent) {
        parentLink = '#' + parent;
        responses += self.menuResponseTemplate({ parentLink: parentLink });
      }
      window.MagPo.app.poem.children.each(function(child) {
        responses += self.responseTemplate(child.toJSON());
      });

      var dialog = new MessageDialogView({ message: responses });
      dialog.render().showModal({});
    },
    openShareDialog: function(e) {
      window.MagPo.app.shareLinkView.openShareDialog(e);
    }
  });

  /**
   * Defines the authentication view.
   */
  var AuthView = window.MagPo.AuthView = Backbone.View.extend({
    el: '#auth',
    events: {
      'click #login': 'login',
      'click #logout': 'logout'
    },
    template: _.template($('#auth-template').html()),
    render: function() {
      var user = '';
      if (window.MagPo.app.user && typeof window.MagPo.app.user.screen_name !== 'undefined') {
        user = window.MagPo.app.user.screen_name;
      }
      $(this.el).html(this.template({
        user: user
      }));
    },
    loggedIn: function() {
      var self = this;
      self.render();
      $('#login', self.$el).hide();
      $('#howdy', self.$el).show();
      $('#logout', self.$el).show();
    },
    login: function(e) {
      var self = this;
      // Save the poem if it hasn't been saved yet so we have a valid
      // return URL.
      if (
        (typeof window.MagPo.app.poem.id === 'undefined' || window.MagPo.app.poem.id === null) &&
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
          success: window.location.toString()
        }),
        dataType: 'json',
        type: 'POST',
        success: function(data) {
          // TODO - use cookies for people with ancient browsers?
          localStorage.setItem('MagPo_tUser', data.tUser);
          window.location = data.location;
        },
        error: function() {
          var dialog = new MessageDialogView({ message: failedToLoginTxt });
          dialog.render().showModal({});
        }
      });
    },
    logout: function(e) {
      // Delete local storage info, etc.
      localStorage.removeItem('MagPo_me');
      localStorage.removeItem('MagPo_user');
      window.MagPo.app.user = null;

      // Force this to false regardless of what it's currently set to.
      isAuthor = false;

      // Re-render stuff.
      this.render();
      postLoad();
    }
  });

  /**
   * Handles a listing view.
   */
  var ListingsView = Backbone.View.extend({
    el: '#listings',
    infoTemplate: _.template($('#info-template').html()),
    poemTemplate: _.template($('#listing-template').html()),
    loadingTemplate: _.template($('#loading-template').html()),
    events: {
      'click .listing': 'loadPoem'
    },
    initialize: function() {
      this.collection.bind('add', this.addOne, this);
      this.collection.bind('reset', this.render, this);
      $(window).on('scroll', this.loadOnScroll);
    },
    render: function() {
      this.collection.each(function(poem) {
        this.addOne(poem);
      });
    },
    addOne: function(poem) {
      var author = '@' + poem.get('author');
      if (author.length > 20) {
        author = 'Anonymous';
      }
      $(this.el).append(this.poemTemplate({
        id: poem.id,
        author: author,
        time: moment(poem.get('changed')).format('D MMM, h:mma'),
        poem: poem.stringify()
      }));
    },
    loadOnScroll: function(e) {
      if (!listingsVisible || loadingListings) {
        return;
      }
      if ($(window).height() + $(window).scrollTop() >= $(document).height() - 600) {
        listingsPage++;
        window.MagPo.app.listings.fetch({ page: listingsPage });
      }
    },
    loadPoem: function(e) {
      // Redirect to a new poem if the id wasn't set and a poem has
      // already been loaded.
      if (!$(e.currentTarget).attr('data-id') && window.MagPo.app.poem.id) {
        window.location = '/magpo/';
        return;
      }

      window.MagPo.app.router.navigate(
        $(e.currentTarget).attr('data-id'),
        { trigger: true }
      );
      $(e.currentTarget).append(this.infoTemplate);
      setTimeout(function() {
        $('#listing-info').fadeOut(1000, function() { $(this).remove(); });
      }, 2000);
    }
  });

  /**
   * Helper function that performs post-loading actions.
   */
  function postLoad() {
    // Re-render the controls.
    window.MagPo.app.controlsView.render();
    window.MagPo.app.shareLinkView.render();
  }

  /**
   * Helper function to reset positions of siblings after we move dom
   * elements around.
   *
   * @param {array} siblings
   *   The list of sibling elements to reposition.
   */
  function repositionSiblings(siblings) {
    _(siblings).each(function(sibling) {
      var sModel = $(sibling).data('backbone-view');
      if (!sModel) {
        return;
      }
      sModel = sModel.model;
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

    self.controlsView = new ControlsView();
    self.fridgeView = new FridgeView({ collection: self.poem });
    self.shareLinkView = new ShareLinkView();
    self.wordBarView = new WordBarView();

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

    self.authView = new AuthView();
    self.listings = new Listings();
    self.listingsView = new ListingsView({ collection: self.listings });

    self.router = null;
  };

  MagPo.prototype.start = function() {
    var self = this;

    throbberEvent.trigger('hide');

    self.authView.render();
    self.listings.fetch();

    var tUser = localStorage.getItem('MagPo_tUser');
    var user = JSON.parse(localStorage.getItem('MagPo_user'));
    var me = localStorage.getItem('MagPo_me');

    // Show a warning dialog if the user isn't logged in.
    if (!user && me) {
      var dialog = new MessageDialogView({ message: needToLoginTxt });
      dialog.render().showModal({});
    }

    // If this is a new poem, go ahead and perform post load actions.
    if (!window.location.hash) {
      postLoad();
    }

    var oauth_token = getParameterByName('oauth_token');
    var oauth_verifier = getParameterByName('oauth_verifier');
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
          var oldId = localStorage.getItem('MagPo_me');

          localStorage.removeItem('MagPo_tUser');

          self.user = user = {
            id: data.id,
            screen_name: data.screen_name
          };

          localStorage.setItem('MagPo_me', user.screen_name);
          localStorage.setItem('MagPo_user', JSON.stringify({
            id: data.id,
            screen_name: data.screen_name
          }));

          self.startRouter();

          // Update any existing poems with the new id.
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
            };
          }

          self.authView.loggedIn();
          postLoad();

          // If the user saved a fork before loggin in, save it to the database.
          var fork = localStorage.getItem('MagPo_poem');
          if (fork) {
            fork = JSON.parse(fork);
            localStorage.removeItem('MagPo_poem');

            // HACK - not super happy about this, but it handles all the
            // loading logic in a simpler way.
            var forkedPoem = new Poem(fork);
            forkedPoem.words.reset(fork.words);
            forkedPoem.save();
          }
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
        localStorage.setItem('MagPo_me', user.screen_name);
        self.authView.loggedIn();
        postLoad();
      }
      self.startRouter();
    }
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

  window.MagPo['class'] = MagPo;

  var loaded = false;
  $(window).load(function() {
    loaded = true;
    if (typeof window.MagPo.app !== 'undefined') {
      window.MagPo.app.start();
    }
  });
  if (typeof window.MagPo === 'undefined') {
    window.MagPo = { };
  }
  $.ajax({
    url: 'app/drawers',
    success: function(drawers) {
      window.MagPo.app = new window.MagPo['class'](drawers);
      if (loaded) {
        window.MagPo.app.start();
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      var drawers = [
        {id: 2, name:'Drupal', words:
          [
            { id: 15, string: '.install', vid: 2},
            { id: 6, string: 'devel', vid: 2}
          ]
        },
        {id: 3, name:'verbs', words:
          [
            { id: 15, string: '.install', vid: 2}
          ]
        }
      ];
      window.MagPo.app = new window.MagPo['class'](drawers);
      console.error(errorThrown);
      var dialog = new window.MessageDialogView({
        message: 'Uh oh! There was a problem loading! Try again later.'
      });
      dialog.render().showModal({});
    }
  });
}(jQuery));

