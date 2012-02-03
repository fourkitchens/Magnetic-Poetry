<!doctype html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en"> <!--<![endif]-->
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">

  <title></title>
  <meta name="description" content="">
  <meta name="author" content="">

  <meta name="viewport" content="width=device-width,initial-scale=1">

  <!-- CSS concatenated and minified via ant build script-->
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/fontkit/fontsheet.css">
  <link rel="stylesheet" href="css/myStyle.css">
  <!-- end CSS-->

  <script src="//ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.min.js"></script>
  <script>window.jQuery || document.write('<script src="js/libs/jquery-1.6.2.min.js"><\/script>')</script>
  <script src="js/libs/modernizr-2.0.6.min.js"></script>
  <script type="text/javascript" src="js/libs/jquery-ui/js/jquery-ui-1.8.17.custom.min.js"></script>
  <script src="http://ajax.cdnjs.com/ajax/libs/json2/20110223/json2.js"></script>
  <script src="js/mylibs/underscore-min.js"></script>
  <script src="js/mylibs/backbone-min.js"></script>

  <script>
  if(typeof(String.prototype.trim) === "undefined") {
    String.prototype.trim = function() {
      return String(this).replace(/^\s+|\s+$/g, '');
    };
  }
  function Word(string) {
    this.string = string;
    this.snap = 'none'; 
  }
  var currentPoem = {};
  jQuery(document).ready(function($) {
    var words=[];
    var entities=["term","node","user","relation","commerce","wysiwyg","commerce"];
    var hookFunctions=["_hook","_preprocess"];
    var functions=["init","form","filter","rdf","dashboard","book","blog","color","block","file","system","path","shortcut","tracker"];
    var words = entities.concat(hookFunctions, functions);
    wordObjects = [];
    for ( var i = 0; i <= words.length; i++) {
      wordObjects[words[i]] = new Word(words[i]);
    }
    wordObjects['_hook'].snap = 'left';
    // a little bit of wiggle cuz we love to wiggle.
    $.each(words, function(i,value) {
      $("#tile" + i + " p").text(value);
      $("#tile" + i).addClass('tile-' + value);
      //$("#tile" + i).addClass('snap-' + 
      rand = Math.floor(Math.random()*2);
      if ( rand == 1 ) {
        $("#tile" + i).css("-webkit-transform", "rotate(-2deg)");
      }
    });
    $( ".draggable" ).draggable();
	  $( "#droppable" ).droppable({
      drop: function( event, ui ) {
        $( this ).addClass( "ui-state-highlight" );
        var word = ui.draggable.text();
        var trimmed = word.trim();
        if (!currentPoem[trimmed]) {
          currentPoem[trimmed] = wordObjects[trimmed];
          $( "<span></span>" ).text( trimmed ).appendTo( 'footer' );
        }
        currentPoem[trimmed].position = $(".tile-" + trimmed).position();
        $.each(currentPoem, function(i, value) {
          
          console.log(value.position.left);
        });
        console.log(currentPoem);
      }
		});

  });


  </script>


</head>

<body>

  <div id="container">
    <header>

    </header>
    <div id="main" role="main" class="group">
      <div id="tiles" class="demo">
        <?php $num_tiles = 20; ?>
        <?php for($i = 0; $i <= $num_tiles; $i++): ?>
          <div id="tile<?php print $i; ?>" class="tile draggable ui-widget-content">
            <p>hook_user</p>
          </div>
        <?php endfor; ?>
      </div><!-- End demo -->
    </div>
    <div id="droppable"><p></p> </div>
    <footer>

    </footer>
  </div> <!--! end of #container -->




  <!-- scripts concatenated and minified via ant build script-->
  <script defer src="js/plugins.js"></script>
  <script defer src="js/script.js"></script>
  <!-- end scripts-->
  <script>
    // backbone.js
    (function($){
      var Word = Backbone.Model.extend({
        defaults: {
          string: 'hello',
          snap: 'none'
        }
      });
      var WordView = Backbone.View.extend({
        tagName: 'div',
        initilaze: function(){
          _.bindAll(this, 'render');
        }
        render: function(){
          $(this.el).html('<span>' + this.model.get('string') + '</span>');
          return this;
        }
      });
      var Drawer = Backbone.Collection.extend({
        model: Word
      });
      var DrawerView = Backbone.View.extend({
        el: $('#container'),

        initialize: function(){
          _.bindAll(this, 'render');

          this.collection = new Drawer(['this', 'that', 'the other']);
          console.log(this.collection);
          this.render();
        },

        render: function(){
          $(this.el).prepend('<div class="drawer"></div>');
        }
      });

      var drawerView = new DrawerView();
    })(jQuery);
  </script>
  <script> // Change UA-XXXXX-X to be your site's ID
    window._gaq = [['_setAccount','UAXXXXXXXX1'],['_trackPageview'],['_trackPageLoadTime']];
    Modernizr.load({
      load: ('https:' == location.protocol ? '//ssl' : '//www') + '.google-analytics.com/ga.js'
    });
  </script>


  <!--[if lt IE 7 ]>
    <script src="//ajax.googleapis.com/ajax/libs/chrome-frame/1.0.3/CFInstall.min.js"></script>
    <script>window.attachEvent('onload',function(){CFInstall.check({mode:'overlay'})})</script>
  <![endif]-->
  
</body>
</html>
