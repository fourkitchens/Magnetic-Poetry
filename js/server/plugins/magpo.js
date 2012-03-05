/**
 * @fileoverview Server-side magpo definition.
 */

var http = require('http');
var mongoose = require('mongoose');
var models = require('../../mylibs/models')
var settings = require('../local');
var underscore = require('underscore');
var url = require('url');

var MagPo = exports;

MagPo.name = 'magpo';

MagPo.attach = function() {
  /**
   * Loads a poem by id from persistant storage.
   *
   * @param {string} id
   *  The unique identifier for the poem.
   */
  this.loadPoem = function(id, callback) {
    this.PoemModel.findOne({ _id: id }, callback);
  };

  /**
   * Saves a poem to persistant storage.
   *
   * @param {object} poem
   *   A poem object to save to the database.
   */
  this.savePoem = function(poem, callback) {
    var self = this;
    // Detect forks.
    if (poem.author != null) {
      self.PoemModel.findOne({ _id: poem.id, author: poem.author }, function(err, doc) {
        // If no poem was found, or the authors don't match, unset the poem
        // id so a new poem will be saved.
        if (doc == null || typeof doc.author === 'undefined' || doc.author !== poem.author) {
          poem.id = null;
        }
        self._savePoem(poem, callback);
      });
    }
    else {
      self._savePoem(poem, callback);
    }
  };

  /**
   * Performs database operations on a save request.
   *
   * @param {object} poem
   *   The poem object to save.
   * @param {function} callback
   *   The function to execute after the poem is saved.
   */
  this._savePoem = function(poem, callback) {
    var self = this;
    var poemObj = new self.PoemModel();
    poemObj.breakpoint = poem.breakpoint;
    var poemModel = new models.Poem({ breakpoint: poem.breakpoint });
    underscore(poem.words).each(function(wordObj) {
      var word = new self.WordModel();
      for (var y in wordObj) {
        word[y] = wordObj[y];
      }
      poemObj.words.push(word);
      var wordModel = new models.Word(word);
      poemModel.words.add(wordModel);
    });

    var poemString = 'bar';
    var title = poemModel.stringify();
    var post = {
      title: title.length ? title : 'all words have been removed from this poem',
      type: 'poem',
      body: {
        und: [
          {
            value: title.length ?
              poemModel.stringify(false).replace(' ', '&nbsp;', 'g') :
              '<a href="/magpo/#' + poem.id + '">fork it and make it better!</a>'
          }
        ]
      },
      field_poem_unique_id: {
        und: [
          { value: poem.id }
        ]
      }
    };

    // If the id exists and the author is set, try to update.
    if (typeof poem.id !== 'undefined' && poem.id != null && poem.author != null) {
      // TODO - this is fragile and assumes words is all we need to save.
      self.PoemModel.update(
        { _id: poem.id, author: poem.author },
        { $set: { words: poemObj.words, breakpoint: poem.breakpoint } },
        function(err) {
          if (err) {
            callback(err, null);
            return;
          }
          callback(err, poem, true);

          // Update the poem in Drupal.
          // If the client didn't send us a nid, look it up!
          if (typeof poem.nid === 'undefined' || poem.nid == null) {
            self.loadPoem(poem.id, function(err, doc) {
              var options = url.parse(settings.drupal.endpoint + 'n/' + doc.nid);
              options.method = 'PUT';
              options.headers = {
                'Cookie': self.cookie.session_name + '=' + self.cookie.sessid + ';',
              };

              request(options, post);
            });
          }
          else {
            var options = url.parse(settings.drupal.endpoint + 'n/' + poem.nid);
            options.method = 'PUT';
            options.headers = {
              'Cookie': self.cookie.session_name + '=' + self.cookie.sessid + ';',
            };
            request(options, post);
          }
        }
      );
    }
    // Else it's a new one!
    else {
      // Generate a unique identifier that will be used to "authenticate" the
      // author. The only time this value is returned (for local storage) is
      // on initial save.
      if (typeof poem.author === 'undefined') {
        poemObj.author = require('node-uuid').v4();
      }
      else {
        poemObj.author = poem.author;
      }
      poemObj.save(function(err) {
        if (err) {
          callback(err, null);
        }
        poem.id = poemObj._id.__id;
        poem.author = poemObj.author;
        callback(err, poem, true);

        // Save the poem to Drupal.
        post.field_poem_unique_id.und[0].value = poem.id;
        var options = url.parse(settings.drupal.endpoint + 'n');
        options.method = 'POST';
        options.headers = {
          'Cookie': self.cookie.session_name + '=' + self.cookie.sessid + ';',
        };
        request(options, post, function(data, statusCode) {
          if (statusCode != 200) {
            return;
          }
          // Update the nid in the database.
          data = JSON.parse(data);
          self.PoemModel.update(
            { _id: poem.id },
            { $set: { nid: data.nid }},
            {},
            function(err) {
              if (err) {
                console.error(err);
                return;
              }
            }
          );
        });
      });
    }
  };

  /**
   * Removes a poem from persistant storage.
   *
   * @param {string} id
   *   The unique identifier for the poem.
   */
  this.removePoem = function(id, callback) {
    this.PoemModel.remove({ _id: id }, callback);
  };
};

MagPo.init = function(done) {
  var self = this;
  // Connect to the database.
  mongoose.connect(settings.db);

  // Make database specific changes here.
  self.WordModel = require('../models/word').WordModel;

  self.PoemModel = require('../models/poem').PoemModel;

  // Log into Drupal.
  var post = {
    username: settings.drupal.user,
    password: settings.drupal.password,
  };
  var options = url.parse(settings.drupal.endpoint + 'u/login');
  options.method = 'POST';
  request(options, post, function(data, statusCode) {
    if (statusCode != 200) {
      // TODO - halt the application?
      return;
    }
    data = JSON.parse(data);
    self.cookie = {
      session_name: data.session_name,
      sessid: data.sessid,
    };
  });

  return done();
};

MagPo.detach = function() {
  mongoose.connection.close();
};

/**
 * Helper function to do a request to the server and callback with the results.
 *
 * @param {object} options
 *   The http.request options hash.
 * @param {object} post
 *   The post object to send.
 * @param {function} callback
 *   The function to callback when the request completes.
 */
function request(options, post, callback) {
  post = JSON.stringify(post);
  if (typeof options.headers === 'undefined') {
    options.headers = {};
  }
  options.headers['Content-Type'] = 'application/json';
  options.headers['Content-Length'] = post.length;
  var req = http.request(options, function saveRequest(res) {
    var data = '';
    res.on('data', function onData(chunk) {
      data += chunk;
    });
    res.on('end', function() {
      if (res.statusCode != 200) {
        console.error('Error (' + res.statusCode + ')');
        console.error(data);
      }
      if (typeof callback === 'function') {
        callback(data, res.statusCode);
      }
    });
  });
  req.write(post);
  req.end();
  req.on('error', function(err) {
    console.error('Request error.');
    console.error(err);
    if (typeof callback === 'function') {
      callback(err, 0);
    }
  });
}
