define(function(require, exports, module) {
  var _ = require('underscore');
  var $ = require('jquery');
  require('jqueryui');
  var Backbone = require('backbone');
  var moment = require('moment');

  var Word = require('lib/models').Word;
  var Drawer = require('lib/models').Drawer;
  var Poem = require('lib/models').Poem;
  var WordCollection = require('lib/models').WordCollection;
  var Listings = require('lib/models').Listings;

  var ModalView = require('vendor/Backbone.ModalDialog');

  var failedToValidateTxt = "Uh oh! There was a problem validating your poem. Why you trying to hack us, bro?";
  var failedToSaveTxt = 'Uh oh! There was a problem saving your poem. Find a Web Chef!';
  var failedToLoginTxt = 'Uh oh! There was a problem logging you in. Find a Web Chef!';
  var needToLoginTxt = "Welcome back! If you'd like to be able to edit your poems later you should really log in from the link at the top.";
  var autosave = true;
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
    if (model instanceof Listings && method === 'read') {
      var page = 0;
      if (options.page) {
        page = options.page;
      }
      loadingListings = true;
      throbberEvent.trigger('show');
      $('#listings').append(MagPo.listingsView.loadingTemplate({}));
      $.ajax({
        url: 'app/list/' + page,
        success: function(data) {
          throbberEvent.trigger('hide');
          _.each(data.poems, function(poem) {
            poem.id = poem._id;
            delete poem._id;
            var poemObj = new Poem(poem);
            _(poem.words).each(function(serverWord) {
              if (!MagPo.drawers[serverWord.vid]) {
                return;
              }
              var drawer = MagPo.drawers[serverWord.vid].model;
              var word = new Word(serverWord);
              if (typeof word === 'undefined') {
                return;
              }
              var wordView = new WordView({
                model: word
              });
              wordView.render();
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
      MagPo.poem.id = id;
      MagPo.poem.fetch({ id: MagPo.poem.id, drawers: MagPo.drawers });
    }
  });

  /**
   * Defines a word view.
   */
  var WordView = Backbone.View.extend({
    tagName: 'div',
    attributes: {
      'class': 'tiles'
    },
    initialize: function() {
      this.model.view = this;
      this.model.bind('change', this.render, this);
    },
    render: function() {
      $(this.el).data('backbone-view', this);

      $(this.el).html('<span>' + this.model.get('string') + '</span>');

      // add the random tilt.
      var rand = Math.floor(Math.random() * 2);
      if (rand === 1) {
        $(this.el).css('-webkit-transform', 'rotate(-2deg)');
      }

      return this;
    }
  });

  var DraggableWordView = WordView.extend({
    attributes: {
      'class': 'draggable tiles'
    },
    initialize: function() {
      this.model.view = this;
      this.model.bind('change', this.render, this);

      // Update the helper and start events if necessary.
      dispatch.on('orientationChange', _.bind(this.orientationChange, this));
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
    orientationChange: function() {
      if (barVisible) {
        $(this.el).draggable('option', 'helper', this.getHelper());
        // Bind the dragstart/stop if it hasn't been bound yet.
        if (!$(this.el).data('draggable').options.start || !$(this.el).data('draggable').options.stop) {
          $(this.el).draggable('option', 'start', _.bind(this.dragstart, this));
          $(this.el).draggable('option', 'stop', _.bind(this.dragstop, this));
        }
      }
      else {
        $(this.el).draggable('option', 'helper', 'original');
      }
    },
    dragstart: function(event, ui) {
      // Check barVisible again in case of an orientation change.
      if (!barVisible) {
        return;
      }
      // Only do this if the word is in a drawer.
      if (event.target.parentElement.id !== 'fridge') {
        MagPo.wordBarView.toggleBar();
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
      this.model.view = this;
      this.model.words.bind('reset', this.addAll, this);
      this.model.words.bind('all', this.render, this);

      $(this.el).droppable({
        accept: '.tiles',
        drop: _.bind(this.drop, this)
      });

      dispatch.on('orientationChange', _.bind(this.orientationChange, this));
    },
    drop: function(event, ui) {
      // We only need to do this on mobile devices.
      if (barVisible) {
        $(ui.draggable).draggable('option', 'helper', $(ui.draggable).data('backbone-view').getHelper());
      }
      var dropped = $(ui.draggable).data('backbone-view').model;
      MagPo.poem.words.remove(dropped);

      // Bail if we're dropping back into the same drawer.
      if ($(ui.draggable).parent().attr('id') === $(this.el).attr('id')) {
        return;
      }

      var siblings = $(ui.draggable).nextAll();
      if (dropped.get('vid') == this.model.id) {
        $(ui.draggable).appendTo(this.$el).offset(ui.offset);
        this.repositionSiblings(siblings);
      }
      else {
        // Unset the top and left values for this item since its drawer is
        // currently hidden and off the screen.
        $(ui.draggable)
          .appendTo(MagPo.drawers[dropped.get('vid')].view.$el)
          .css('top', '')
          .css('left', '');
        this.repositionSiblings(siblings);
      }
    },
    orientationChange: function() {
      if (barVisible) {
        var height = ($(window).height() - $('#word-bar').height() - $('#drawer-container').height());
        $(this.el).css('height', height);
      }
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
      this.model.words.each(_.bind(function(word) {
        var wordView = new DraggableWordView({
          model: word
        });
        wordView.render();
        if (word.get('top') == null || word.get('left') == null) {
          $(this.el).append(wordView.$el);
        }
      }, this));
    },

    /**
     * Helper function to reset positions of siblings after we move dom
     * elements around.
     *
     * Note: this function does not change the offset based on the viewport
     * since this is happening in the drawer.
     *
     * @param {array} siblings
     *   The list of sibling elements to reposition.
     */
    repositionSiblings: function(siblings) {
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
          offset: sModel.get('left') + ' ' + sModel.get('top'),
          collision: 'none'
        });
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
    events: {
      click: 'click'
    },
    initialize: function() {
      this.render();
    },
    render: function() {
      $(this.el).html(this.model.get('name'));
      $('#drawer-handles').append(this.$el);
    },
    click: function() {
      // Bail if this handle's drawer is already open.
      if ($(this.el).hasClass('open-handle')) {
        $(this.el).removeClass('open-handle');
        return;
      }
      $('.open-handle').removeClass('open-handle');
      $(this.el).addClass('open-handle');
      if ($('.open-drawer').length === 1) {
        $('.open-drawer').removeClass('open-drawer').hide();
        $(this.model.view.$el).addClass('open-drawer').show();
      }
    }
  });

  /**
   * Defines a view that is shared by various representations of the poem.
   */
  var PoemView = Backbone.View.extend({
    /**
     * Transforms numbers based on the breakpoint ratios.
     *  phone size is: 480 wide and 310 tall
     *  desktop size is: 600 wide x 378 tall
     *  ratio is .8*
     *
     * @param {number} startNum
     *   The number we are working on.
     * @param {string} from
     *   The breakpoint we are transforming from.
     * @param {string} to
     *   The breakpoint we are transforming to.
     *
     * @return {number}
     *   The transformed number. If the breakpoints match
     *   will return the original number.
     */
    resizeWord: function(startNum, from, to) {
      var resultNum = startNum;
      if (from === to) {
        return resultNum;
      }
      if (to === 'phone') {
        resultNum = startNum * 0.8;
      }
      else if (to === 'desktop') {
        resultNum = startNum * 1.25;
      }
      else if (to === 'phoneListing') {
        resultNum = startNum * 0.25;
      }
      return resultNum;
    },
    repositionSiblings: function(siblings) {
      _(siblings).each(_.bind(function(sibling) {
        var sModel = $(sibling).data('backbone-view');
        if (!sModel) {
          return;
        }
        sModel = sModel.model;
        var resizedOffset = {
          top: this.resizeWord(sModel.get('top'), 'desktop', this.breakpoint),
          left: this.resizeWord(sModel.get('left'), 'desktop', this.breakpoint)
        };
        $(sibling).position({
          of: this.$el,
          my: 'left top',
          at: 'left top',
          offset: resizedOffset.left + ' ' + resizedOffset.top,
          collision: 'none'
        });
      }, this));
    },
    initialize: function() {
      this.breakpoint = ($('#fridge').width() === 480) ? 'phone' : 'desktop';
      dispatch.on('orientationChange', _.bind(this.orientationChange, this));
    },
    render: function(breakpoint) {
      if (typeof breakpoint === 'undefined') {
        breakpoint = this.breakpoint;
      }
      // First append the words to the dom.
      this.collection.words.each(_.bind(function(word) {
        $(word.view.el).appendTo(this.$el);
      }, this));
      // Then set their positions all at once.
      this.collection.words.each(_.bind(function(word) {
        var left = this.resizeWord(word.get('left'), 'desktop', breakpoint);
        var top = this.resizeWord(word.get('top'), 'desktop', breakpoint);
        $(word.view.el).position({
          of: this.$el,
          my: 'left top',
          at: 'left top',
          offset: left + ' ' + top,
          collision: 'none'
        });
      }, this));
      return this;
    },
    orientationChange: function() {
      this.breakpoint = ($('#fridge').width() === 480) ? 'phone' : 'desktop';
    }
  });

  /**
   * Defines the moving "word-bar" panel.
   */
  var WordBarView = PoemView.extend({
    el: $('#drawers-container'),
    events: {
      'click #word-bar-handle': 'toggleBar'
    },
    initialize: function() {
      var height = ($(window).height() - $('#word-bar').height());
      this.hiddenHeight = height * -1;
      this.render();

      dispatch.on('orientationChange', _.bind(this.orientationChange, this));
    },
    render: function() {
      if (barVisible) {
        var height = ($(window).height() - $('#word-bar').height());
        $('#drawers-container').css({
          height: height,
          top: this.hiddenHeight
        });
        $('#word-bar-handle').droppable({
          accept: '.tiles',
          over: _.bind(this.over, this),
          out: _.bind(this.out, this),
          drop: _.bind(this.drop, this)
        });
      }
    },
    orientationChange: function() {
      var height = ($(window).height() - $('#word-bar').height());
      this.hiddenHeight = (height * -1);
      // Resize the drawers according to the current state.
      if (!barVisible) {
        $('#drawers-container').css({
          height: '300px',
          top: '0px'
        });
      }
      else if (barVisible) {
        this.render();
      }
    },
    over: function(event, ui) {
      $('#word-bar-handle').text('x remove x');
    },
    out: function(event, ui) {
      $('#word-bar-handle').text('^ words ^');
    },
    drop: function(event, ui) {
      $('#word-bar-handle').text('^ words ^');
      var dropped = $(ui.draggable).data('backbone-view').model;
      MagPo.poem.words.remove(dropped);

      var siblings = $(ui.draggable).nextAll();
      // Unset the top and left values for this item since its drawer is
      // currently hidden and off the screen.
      $(ui.draggable)
        .appendTo(MagPo.drawers[dropped.get('vid')].view.$el)
        .css('top', '')
        .css('left', '')
        .draggable(
          'option',
          'helper',
          $(ui.draggable).data('backbone-view').getHelper()
        );
      this.repositionSiblings(siblings);
    },
    toggleBar: function() {
      if ($('#drawers-container').hasClass('down')) {
        $('#word-bar-handle').text('^ words ^');
        $('#drawers-container').css('top', this.hiddenHeight);
      }
      else {
        $('#word-bar-handle').text('v poem v');
        $('#drawers-container').css('top', 0);
      }
      $('#drawers-container').toggleClass('down');
    }
  });

  /**
   * Defines the poem listing view.
   *
   */
  var PoemListingView = PoemView.extend({
    initialize: function() {
      this.breakpoint = 'phoneListing';
    },
    render: function(breakpoint) {
      if (typeof breakpoint === 'undefined') {
        breakpoint = this.breakpoint;
      }
      // First append the words to the dom.
      this.collection.words.each(_.bind(function(word) {
        $(word.view.el).appendTo(this.$el);
      }, this));
      // Then set their positions all at once.
      this.collection.words.each(_.bind(function(word) {
        var left = this.resizeWord(word.get('left'), 'desktop', breakpoint);
        var top = this.resizeWord(word.get('top'), 'desktop', breakpoint);
        $(word.view.el).position({
          of: this.$el,
          my: 'left top',
          at: 'left top',
          offset: left + ' ' + top,
          collision: 'none'
        });
      }, this));
      return this;
    }
  });

  /**
   * Defines the fridge (workspace) view.
   */
  var FridgeView = PoemView.extend({
    el: $('#fridge'),
    initialize: function() {
      PoemView.prototype.initialize.call(this);

      // Handle droppable events.
      $(this.el).droppable({
        accept: '.tiles',
        drop: _.bind(this.drop, this),
        out: _.bind(this.out, this)
      });

      // Handle orientation changes.
      dispatch.on('orientationChange', _.bind(this.orientationChange, this));
    },
    drop: function(event, ui) {
      // We only need to do this on mobile devices.
      if (barVisible) {
        $(ui.draggable).draggable(
          'option',
          'helper',
          $(ui.draggable).data('backbone-view').getHelper()
        );
      }
      var fridgeOffset = $(this.el).offset();
      var dropped = $(ui.draggable).data('backbone-view').model;
      var dropOffset = ui.offset;
      var resultOffset = {
        top: dropOffset.top - fridgeOffset.top,
        left: dropOffset.left - fridgeOffset.left
      };
      var resizedOffset = {
        top: this.resizeWord(resultOffset.top, this.breakpoint, 'desktop'),
        left: this.resizeWord(resultOffset.left, this.breakpoint, 'desktop')
      };
      // if it's not currently in the poem, append to fridge
      if (!MagPo.poem.words.get({ id: dropped.id })) {
        // Move the element to the fridge so we can hide the drawer and
        // reset its position relative to the fridge.
        var siblings = $(ui.draggable)
          .appendTo(this.$el)
          .position({
            of: this.$el,
            my: 'left top',
            at: 'left top',
            offset: resultOffset.left + ' ' + resultOffset.top,
            collision: 'none'
          })
          .prevAll();

        this.repositionSiblings(siblings);

        dropped.set('top', resizedOffset.top);
        dropped.set('left', resizedOffset.left);
        MagPo.poem.words.add(dropped);
      }
      // otherwise only change the position on the model.
      else {
        dropped.set('top', resizedOffset.top);
        dropped.set('left', resizedOffset.left);
        MagPo.poem.words.sort();
      }

      // If the poem has already been saved once, autosave on drop.
      if (MagPo.poem.isAuthor && MagPo.poem.id) {
        if (MagPo.timeout) {
          clearTimeout(MagPo.timeout);
        }
        MagPo.timeout = setTimeout(
          function() {
            MagPo.poem.save({
              words: MagPo.poem.getWords(),
              breakpoint: MagPo.poem.get('breakpoint')
            }, { user: MagPo.user });
          },
          MagPo.delay
        );
      }
    },
    out: function(event, ui) {
      var dropped = $(ui.draggable).data('backbone-view').model;
      MagPo.poem.words.remove(dropped);

      // If the poem has already been saved once, autosave on out.
      if (MagPo.poem.isAuthor && MagPo.poem.id) {
        if (MagPo.timeout) {
          clearTimeout(MagPo.timeout);
        }
        MagPo.timeout = setTimeout(function() {
          MagPo.poem.save({
            words: MagPo.poem.getWords(),
            breakpoint: MagPo.poem.get('breakpoint')
          });
        }, MagPo.delay);
      }
    },
    orientationChange: function() {
      PoemView.prototype.orientationChange.call(this);
      this.render();
    }
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
      if (!MagPo.poem.isAuthor) {
        // If the user isn't logged in, we're going to prevent forks.
        if (MagPo.user) {
          $(this.el).html('Respond');
        }
        else {
          $(this.el).html('Login to respond');
        }
      }
      else if (!MagPo.poem.id) {
        $(this.el).html('Share');
      }
      else {
        $(this.el).html('Share changes');
      }
    },
    openShareDialog: function(event) {
      autosave = false;
      event.stopPropagation();

      if (!MagPo.poem.id && !MagPo.poem.words.length) {
        var dialog = new MessageDialogView({ message: 'Add some words to your poem before sharing!' });
        dialog.render().showModal({});
        return;
      }

      // If the user isn't logged in, bail on this, and log them in.
      // The poem will be saved in its current state and updated when
      // we get back.
      if (!MagPo.poem.isAuthor && !MagPo.user) {
        // Store the poem in local storage,
        // we'll save it to the database when login is complete.
        localStorage.setItem('MagPo_poem', JSON.stringify(MagPo.poem.toJSON()));
        MagPo.authView._login();
        return;
      }

      // Stop any autosaves.
      if (MagPo.timeout) {
        clearTimeout(MagPo.timeout);
      }

      // Add a listener to show the dialog after saving is complete.
      // This function needs to be run once after the poem save link is clicked.
      // @see https://github.com/documentcloud/backbone/pull/594
      MagPo.poem.on('saveSuccess', _.once(function(msg) {
        if (msg === 'ok') {
          // Create the modal view over the fridge.
          var view = new ShareDialogView();
          var fridgeOffset = $('#fridge').offset();
          view.render().showModal({ x: fridgeOffset.left, y: fridgeOffset.top });
          twttr.widgets.load();

          if (!MagPo.user) {
            $('#loginInfo').show();
          }
        }

        autosave = true;
      }));

      // Save the poem.
      MagPo.poem.save({
        words: MagPo.poem.getWords(),
        breakpoint: MagPo.poem.get('breakpoint')
      }, { user: MagPo.user });
    }
  });

  /**
   * Defines the share dialog view.
   */
  var ShareDialogView = ModalView.extend({
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
        string = MagPo.poem.stringify();
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
      MagPo.authView._login();
    }
  });

  /**
   * Defines the message dialog view.
   */
  var MessageDialogView = ModalView.extend({
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
      $(this.el).html(
        this.template({
          message: this.options.message
        })
      );

      return this;
    }
  });

  /**
   * Defines the controls view.
   */
  var ControlsView = Backbone.View.extend({
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
      $('#responses-handle').hide();
      if (MagPo.poem.children.length || MagPo.poem.get('parent')) {
        $('#responses-handle').show();
      }

      // Move the menu into the word-bar on mobile devices.
      if (barVisible) {
        $('menu').prependTo('#word-bar');
      }

      if (MagPo.user) {
        $('#login-menu')
          .html(this.avatarTemplate({ user: MagPo.user.screen_name }))
          .addClass('logged-in');
      }
    },
    toggleLogin: function(e) {
      if (MagPo.user) {
        MagPo.authView.logout();
        $('#login-menu').toggleClass('logged-in').text('Login');
      }
      else {
        MagPo.authView.login();
        $('#login-menu')
          .html(this.avatarTemplate({ user: MagPo.user.screen_name }))
          .toggleClass('logged-in');
      }
    },
    showResponses: function(event) {
      var responses = '';
      var parent = MagPo.poem.get('parent');
      var parentLink = false;

      event.stopPropagation();

      if (parent) {
        parentLink = '#' + parent;
        responses += this.menuResponseTemplate({ parentLink: parentLink });
      }

      MagPo.poem.children.each(_.bind(function(child) {
        responses += this.responseTemplate(child.toJSON());
      }, this));

      var dialog = new MessageDialogView({ message: responses });
      dialog.render().showModal({});
    },
    openShareDialog: function(e) {
      MagPo.shareLinkView.openShareDialog(e);
    }
  });

  /**
   * Defines the authentication view.
   */
  var AuthView = Backbone.View.extend({
    el: '#auth',
    events: {
      'click #login': 'login',
      'click #logout': 'logout'
    },
    template: _.template($('#auth-template').html()),
    render: function() {
      var user = '';
      if (MagPo.user && typeof MagPo.user.screen_name !== 'undefined') {
        user = MagPo.user.screen_name;
      }
      $(this.el).html(this.template({
        user: user
      }));
    },
    loggedIn: function() {
      this.render();
      $('#login', this.$el).hide();
      $('#howdy', this.$el).show();
      $('#logout', this.$el).show();
    },
    login: function(e) {
      // Save the poem if it hasn't been saved yet so we have a valid
      // return URL.
      if (
        (typeof MagPo.poem.id === 'undefined' || MagPo.poem.id === null) &&
        MagPo.poem.words.length
      ) {
        MagPo.poem.save({}, { user: MagPo.user });
        MagPo.poem.on('saveSuccess', _.bind(function() {
          this._login();
          MagPo.poem.off('saveSuccess');
        }, this));
      }
      else {
        this._login();
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
      MagPo.user = null;

      // Force this to false regardless of what it's currently set to.
      MagPo.poem.isAuthor = false;

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
      var poemListingView = new PoemListingView({collection: poem});
      if (author.length > 20) {
        author = 'Anonymous';
      }
      $(this.el).append(this.poemTemplate({
        id: poem.id,
        author: author,
        time: moment(poem.get('changed')).format('D MMM, h:mma'),
        poem: poemListingView.render().$el.html()
      }));
    },
    loadOnScroll: function(e) {
      if (!listingsVisible || loadingListings) {
        return;
      }
      if ($(window).height() + $(window).scrollTop() >= $(document).height() - 600) {
        listingsPage++;
        MagPo.listings.fetch({ page: listingsPage });
      }
    },
    loadPoem: function(e) {
      // Redirect to a new poem if the id wasn't set and a poem has
      // already been loaded.
      if (!$(e.currentTarget).attr('data-id') && MagPo.poem.id) {
        window.location = '/drupo/';
        return;
      }

      MagPo.router.navigate(
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
    MagPo.controlsView.render();
    MagPo.shareLinkView.render();
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
  var MagPo = {
    initialized: false,
    started: false,
    init: function(drawers) {
      this.initialized = true;
      this.timeout = false;
      this.user = false;
      this.delay = 1000;
      // TODO - detect the correct breakpoint.
      this.poem = new Poem({ breakpoint: 'desktop' });
      this.attachListeners(this.poem);

      this.controlsView = new ControlsView();
      this.fridgeView = new FridgeView({ collection: this.poem });
      this.shareLinkView = new ShareLinkView();
      this.wordBarView = new WordBarView();

      var shown = false;
      this.drawers = {};
      _(drawers).each(_.bind(function(drawer) {
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
        this.drawers[drawer.id] = drawerObj;
      }, this));

      this.authView = new AuthView();
      this.listings = new Listings();
      this.listingsView = new ListingsView({ collection: this.listings });

      this.router = null;
    },
    attachListeners: function(poem) {
      // Handle events from the poem model.
      poem.on('fetching', _.bind(this.fetching, this));
      poem.on('fetchSuccess', _.bind(this.fetchSuccess, this));
      poem.on('fetchError', _.bind(this.fetchError, this));
      poem.on('saving', _.bind(this.saving, this));
      poem.on('saveSuccess', _.bind(this.saveSuccess, this));
      poem.on('saveError', _.bind(this.saveError, this));
      poem.on('saveRedirect', _.bind(this.saveRedirect, this));
    },
    fetching: function(message) {
      throbberEvent.trigger('show');
    },
    fetchSuccess: function(message) {
      throbberEvent.trigger('hide');
      this.fridgeView.render();
      postLoad();
    },
    fetchError: function(message) {
      throbberEvent.trigger('hide');

      var txt = 'There was a problem loading the poem.';

      // Handle specific errors.
      if (message === 404) {
        txt = 'The poem you were looking for could not be found or has been unpublished.';

        this.poem.id = null;
        this.router.navigate(this.poem.id, { trigger: false });
      }

      var dialog = new MessageDialogView({ message: txt });
      dialog.render().showModal({});
    },
    saving: function(message) {
      throbberEvent.trigger('show');
    },
    saveSuccess: function(message) {
      throbberEvent.trigger('hide');
    },
    saveError: function(message) {
      throbberEvent.trigger('hide');

      // Prevent dialogs during autosaves.
      if (!autosave) {
        var txt = (message == 406) ? failedToValidateTxt : failedToSaveTxt;
        var dialog = new MessageDialogView({ message: txt });
        dialog.render().showModal({});
      }
    },
    saveRedirect: function(message) {
      // Update the URL and perform post loading actions.
      this.router.navigate(this.poem.id, { trigger: message });
      postLoad();
    },
    onSuccess: function(data) {
      // Go ahead and start the router so the poem is loaded.
      var oldId = localStorage.getItem('MagPo_me');

      localStorage.removeItem('MagPo_tUser');

      var user = this.user = {
        id: data.id,
        screen_name: data.screen_name
      };

      localStorage.setItem('MagPo_me', user.screen_name);
      localStorage.setItem('MagPo_user', JSON.stringify({
        id: data.id,
        screen_name: data.screen_name
      }));

      this.startRouter();

      // Update any existing poems with the new id.
      if (oldId && this.poem.id) {
        var worker = new Worker('/drupo/js/update.js');
        worker.postMessage({
          callback: window.location.origin + '/drupo/app/update/' + this.poem.id,
          id: this.poem.id,
          oldAuthor: oldId,
          newAuthor: data.screen_name
        });
        worker.onmessage = function(event) {
          if (event.data !== 200) {
            console.error(util.format('Error (%d): Error updating poem.'));
          }
        };
      }

      this.authView.loggedIn();
      postLoad();

      // If the user saved a fork before loggin in, save it to the database.
      var fork = localStorage.getItem('MagPo_poem');
      if (fork) {
        fork = JSON.parse(fork);
        localStorage.removeItem('MagPo_poem');

        // Replace the poem with the fork, re-attach the listeners, and save.
        this.poem = this.fridgeView.collection = new Poem(fork);
        this.attachListeners(this.poem);
        this.poem.words.reset();
        _.each(fork.words, _.bind(function(fWord) {
          var word = this.drawers[fWord.vid].model.words.get(fWord.id);
          word.set('top', fWord.top);
          word.set('left', fWord.left);
          this.poem.words.add(word);
        }, this));

        this.poem.save({}, { user: this.user });
      }
    },
    start: function() {
      this.started = true;
      throbberEvent.trigger('hide');

      this.authView.render();
      this.listings.fetch();

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
        var body = {
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
          success: _.bind(this.onSuccess, this),
          error: function() {
            localStorage.removeItem('MagPo_tUser');
            // TODO - show an error and start the router?
          }
        });
      }
      else {
        if (user) {
          this.user = user;
          localStorage.setItem('MagPo_me', user.screen_name);
          this.authView.loggedIn();
          postLoad();
        }
        this.startRouter();
      }
    },
    /**
     * Starts the router.
     * NOTE: This can only happen after the window is loaded to avoid
     *  issues with positioning tiles in webkit browsers.
     */
    startRouter: function() {
      this.router = new AppRouter();
      Backbone.history.start();
      $(document).on('touchmove', '.tiles', function(e) {});
    },
    messageDialogView: MessageDialogView
  };

  return MagPo;
});
