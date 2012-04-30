var jsdom = require('jsdom');

/*global module:false*/
module.exports = function(grunt) {

  // Custom task to minify and remove non-minified files.
  grunt.registerTask('mymin', 'Concat, minify, and remove full files from markup.', function() {
    var done = this.async();
    jsdom.env(
      'index.html',
      ['http://code.jquery.com/jquery-1.5.min.js'],
      function(errors, window) {
        // Collect the files to be minified.
        var files = new Array();
        (function($) {
          $('script').each(function() {
            if ($(this).data('min') === 'magpo') {
              files.push($(this).attr('src'));
            }
          });
          console.log(files);
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
        dest: 'js/magpo-0.1.0.js'
      }
    },
    min: {
      dist: {
        src: 'js/magpo-0.1.0.js',
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