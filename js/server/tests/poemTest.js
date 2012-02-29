var flatiron = require('flatiron');

exports.poemTests = {
  'setUp': function(callback) {
    this.app = flatiron.app;
    this.app.use(require('../plugins/magpo'));
    this.app.init(function(err) {
      if (err) {
        console.error(err);
      }
    });

    this.poem = {
      words: [
        {
          string: 'foo',
        },
        {
          string: 'bar',
        },
      ],
    };
    callback();
  },
  'tearDown': function(callback) {
    require('../plugins/magpo').detach();
    callback();
  },
  'save poem': function(test) {
    var self = this;
    test.expect(1);
    self.app.savePoem(self.poem, function(err, poem) {
      test.notStrictEqual((typeof poem.id), 'undefined', 'Poem id was set.');
      self.app.removePoem(poem.id, function(err) {
        test.done();
      });
    });
  },
  'load poem': function(test) {
    var self = this;
    test.expect(2);
    self.app.savePoem(self.poem, function(err, poem) {
      self.app.loadPoem(poem.id, function(err, poem) {
        test.equal(poem.words[0].string, self.poem.words[0].string, 'First word confirmed.');
        test.equal(poem.words[1].string, self.poem.words[1].string, 'Second word confirmed.');
        self.app.removePoem(poem.id, function(err) {
          test.done();
        });
      });
    });
  },
  'remove poem': function(test) {
    var self = this;
    test.expect(1);
    self.app.savePoem(self.poem, function(err, poem) {
      self.app.removePoem(poem.id, function(err) {
        self.app.loadPoem(poem.id, function(err, doc) {
          test.equal(doc, null, 'Poem was removed.');
          test.done();
        });
      });
    });
  },
};

