/**
 * @fileoverview Server-side magpo definition.
 */

var http = require('http');
var mongoose = require('mongoose');
var models = require('../../mylibs/models')
var settings = require('../local');
var underscore = require('underscore');
var url = require('url');
var UserModel = require('../models/user').UserModel;

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
   * Validates a poem against the current available word sets.
   *
   * @param {object} poem
   *   The poem object to validate.
   * @param {function} callback
   *   The function to call back when validation is complete.
   */
  this.validatePoem = function(poem, callback) {
    var self = this;
    var valid = true;

    var validateWords = function() {
      // TODO - cache money, baby!
      var options = url.parse(settings.words);
      http.get(options, function onGet(res) {
        var data = '';
        res.on('data', function onData(chunk) {
          data += chunk;
        });

        res.on('end', function onEnd() {
          var drawers = JSON.parse(data);
          // Walk through our poem and confirm the words are valid.
          underscore(poem.words).each(function(poemWord) {
            // If we found one invalid word the poem is invalid.
            if (valid == false) {
              return;
            }
            valid = false;
            underscore(drawers).each(function(drawer) {
              if (drawer.id == poemWord.vid) {
                underscore(drawer.words).each(function(word) {
                  if (word.id == poemWord.id && word.string == poemWord.string) {
                    valid = true;
                  }
                });
              }
            });
          });
          callback(valid);
        });
      })
        .on('error', function(e) {
          console.error(e);
          valid = false;
          callback(valid);
        });
    };

    // First, if the author is set, verify that it's valid.
    if (poem.author && typeof poem.author === 'object') {
      UserModel.findOne(
        {
          access_token: poem.author.id,
          screen_name: poem.author.screen_name
        },
        function(err, doc) {
          if (err || !doc) {
            valid = false;
            callback(valid);
            return;
          }
          validateWords();
        }
      );
    }
    else {
      validateWords();
    }
  };

  /**
   * Saves a poem to persistant storage.
   *
   * @param {object} poem
   *   A poem object to save to the database.
   */
  this.savePoem = function(poem, callback) {
    var self = this;
    var fork = false;

    self.validatePoem(poem, function onValidated(valid) {
      if (valid != true) {
        // Bail out with a 406 header to be sent to the client.
        callback(406, null);
        return;
      }

      // Reset the author to a string if it's an object.
      if (poem.author && typeof poem.author.screen_name != 'undefined') {
        poem.author = poem.author.screen_name;
      }

      // Detect forks.
      if (poem.author) {
        self.PoemModel.findOne({ _id: poem.id, author: poem.author }, function(err, doc) {
          // If no poem was found, or the authors don't match, unset the poem
          // id so a new poem will be saved.
          if (doc == null || typeof doc.author === 'undefined' || doc.author !== poem.author) {
            fork = poem.id;
            poem.id = null;
          }
          self._savePoem(poem, fork, callback);
        });
      }
      else {
        if (poem.id) {
          fork = poem.id;
          poem.id = null;
        }
        self._savePoem(poem, fork, callback);
      }
    });
  };

  /**
   * Performs database operations on a save request.
   *
   * @param {object} poem
   *   The poem object to save.
   * @param {mixed} fork
   *   false if this is not a fork, else the ObjectID hash
   *   for the parent poem.
   * @param {function} callback
   *   The function to execute after the poem is saved.
   */
  this._savePoem = function(poem, fork, callback) {
    var self = this;
    var redirect = false;
    var poemObj = new self.PoemModel();
    poemObj.breakpoint = poem.breakpoint;
    if (fork) {
      poemObj.parent = fork;
    }
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
            callback(500, null, redirect);
            return;
          }
          callback(err, poem, redirect);

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
      if (!poem.author) {
        poemObj.author = require('node-uuid').v4();
      }
      else {
        poemObj.author = poem.author;
      }
      poemObj.save(function(err) {
        if (err) {
          callback(500, null, redirect);
        }
        poem.id = poemObj._id.__id;
        poem.author = poemObj.author;
        redirect = true;
        callback(err, poem, redirect);

        // If this was a fork, add the new id to the parent's child array.
        if (fork) {
          self.PoemModel.findOne({ _id: fork }, function(err, doc) {
            if (err) {
              console.error(err);
              return;
            }
            doc.children.push(poem.id);
            doc.save(function(err) {
              if (err) {
                console.error(err);
                return;
              }
            });
          });
        }

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

  /**
   * Updates a poem's author.
   *
   * @param {string} id
   *   The poem ID to update.
   * @param {string} oldAuthor
   *   The old author.
   * @param {string} newAuthor
   *   The new author.
   * @param {function} callback
   *   The callback function to execute on completion.
   */
  this.updatePoemAuthor = function(id, oldAuthor, newAuthor, callback) {
    this.PoemModel.update(
      { _id: id, author: oldAuthor },
      { $set: { author: newAuthor } },
      function(err, numChanged) {
        if (err) {
          console.error(err);
        }
        callback(err);
      }
    );
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
