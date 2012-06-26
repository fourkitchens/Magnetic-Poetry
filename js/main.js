require.config({
  paths: {
    jquery: [
      'http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min',
      'vendor/jquery-1.7.2.min'
    ],
    underscore: 'vendor/underscore-min',
    backbone: 'vendor/backbone-min'
  },
  shim: {
    underscore: {
      exports: '_',
    },
    backbone: {
      deps: ['underscore', 'jquery'],
      exports: 'Backbone'
    }
  }
});

require(['jquery', 'magpo'], function($, MagPo) {
  var loaded = false;
  $(window).load(function() {
    loaded = true;
    if (!MagPo.started) {
      MagPo.start();
    }
  });
  if (typeof window.MagPo === 'undefined') {
    window.MagPo = { };
  }
  $.ajax({
    url: 'app/drawers',
    success: function(drawers) {
      MagPo.init(drawers);
      if (loaded) {
        MagPo.start();
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
      MagPo.init(drawers);
      console.error(errorThrown);
      var dialog = new window.MessageDialogView({
        message: 'Uh oh! There was a problem loading! Try again later.'
      });
      dialog.render().showModal({});
    }
  });
});

