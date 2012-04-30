var jsdom = require('jsdom');

/*global module:false*/
module.exports = function(grunt) {

  // Custom task to concat and remove non-concated files.
  grunt.registerMultiTask('mycat', 'Concat and remove full files from markup.', function() {
    var self = this;
    var done = self.async();

    jsdom.env(
      'index.html',
      ['http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js'],
      function(errors, window) {
        // Collect the files to be concated.
        var files = new Array();
        (function($) {
          var magpoFilter = function() {
            return $(this).data('min') === 'magpo';
          };

          $('script').filter(magpoFilter).each(function() {
            files.push($(this).attr('src'));
          });
          var options = {};
          if (self.data.separator) {
            options.separator = self.data.separator;
          }
          var src = grunt.helper('concat', files, options);
          grunt.file.write(self.file.dest, src);

          if (self.errorCount) { done(false); }
          grunt.log.writeln('File "' + self.file.dest + '" created.');

          $('script').filter(magpoFilter).filter(':last').each(function() {
            // JQuery doesn't insert into the DOM in a way that we can print to
            // a string, so use vanilla JavaScript.
            var script = window.document.createElement('script');
            script.type = 'text/javascript';
            script.src = self.file.dest;
            var parentElm = this.parentNode;
            parentElm.insertBefore(script, this);
          });

          $('script').filter(magpoFilter).remove();

          grunt.file.write('index.html', window.document.documentElement.innerHTML);

          if (self.errorCount) { done(false); }
          grunt.log.writeln('meow');

          done();
        }(window.jQuery));
      }
    );
  });

  // Project configuration.
  grunt.initConfig({
    // the staging directory used during the process
    staging: 'intermediate',
    // final build output
    output: 'publish',
    // filter any files matching one of the below pattern during mkdirs task
    // the pattern in the .gitignore file should work too.
    exclude: '.git* build/** node_modules/** grunt.js package.json *.md'.split(' '),
    mkdirs: {
      staging: '<config:exclude>'
    },
    // concat css/**/*.css files, inline @import, output a single minified css
    css: {
      'css/style.css': ['css/**/*.css']
    },
    // Renames JS/CSS to prepend a hash of their contents for easier
    // versioning
    rev: {
      js: 'js/**/*.js',
      css: 'css/**/*.css',
      img: 'img/**'
    },
    // update references in html to revved files
    usemin: {
      files: ['**/*.html']
    },
    // html minification
    html: '<config:usemin>',
    // Optimizes JPGs and PNGs (with jpegtran & optipng)
    img: {
      dist: '<config:rev.img>'
    },
    watch: {
      files: '<config:lint.files>',
      tasks: 'lint qunit'
    },
    pkg: '<json:package.json>',
    meta: {
      banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
    },
    lint: {
      files: ['grunt.js', 'js/**/*.js', 'test/**/*.js']
    },
    qunit: {
      files: ['test/**/*.html']
    },
    concat: {
      dist: {
        src: ['js/plugins.js', 'js/main.js'],
        dest: 'js/magpo-<%= pkg.version %>.js'
      }
    },
    mycat: {
      dist: {
        dest: 'js/magpo-<%= pkg.version %>.js'
      }
    },
    min: {
      dist: {
        src: 'js/magpo-<%= pkg.version %>.js',
        dest: 'js/main.js'
      }
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        eqnull: true,
        browser: true
      },
      globals: {
        jQuery: true
      }
    },
    uglify: {}
  });

};
