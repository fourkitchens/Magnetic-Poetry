/**
 * @fileoverview MagPo server implementation.
 */

var flatiron = require('flatiron');
var settings = require('./local');
var app = flatiron.app;
var und = require('underscore');

// Define the default response headers.
var headers = {
  'Content-Type': 'application/json',
};

app.use(flatiron.plugins.http);
app.use(require('./plugins/magpo'));
app.use(require('./plugins/twitter'));

app.init(function(err) {
  if (err) {
    console.error(err);
  }
});

/**
 * GET routes.
 */
app.router.get('/', function() {
  this.res.writeHead(200, headers);
  this.res.json({ status: 'ok' });
});

app.router.get('/drawers', function() {
  var self = this;
  app.getWords(function(drawers) {
    self.res.json(drawers);
  });
});

app.router.get('/save', function() {
  this.res.writeHead(400, headers);
  this.res.json({
    status: 'error',
    error: 'Only POST requests are accepted.'
  });
});

app.router.get('/list/:page', function(page) {
  var self = this;
  app.list(page, function(err, docs) {
    if (err) {
      self.res.writeHead(500, headers);
      self.res.json({ status: 'error' });
      return;
    }

    self.res.json({ status: 'ok', poems: docs });
  });
});

/**
 * POST routes.
 */
app.router.post('/login', function() {
  var self = this;
  if (typeof self.req.body.success === 'undefined') {
    self.res.writeHead(400, headers);
    self.res.json({ status: 'error', error: 'Missing success URL.' });
    return;
  }
  app.login(self.req, self.res, self.req.body.success);
});

app.router.post('/login-verify', function() {
  app.loginVerify(this.req, this.res);
});

app.router.post('/load/:id', function(id) {
  var self = this;
  app.loadPoem(id, function onLoad(err, doc) {
    if (err) {
      console.error(err);
      self.res.writeHead(500, headers);
      self.res.json({ status: 'error', error: 'Error loading poem.' });
      return;
    }
    if (doc == null) {
      self.res.writeHead(404, headers);
      self.res.json({ status: 'error', error: 'Poem not found.' });
      return;
    }

    // Set a flag about whether or not the author matches.
    var author = false;
    if (self.req.body.author === doc.author) {
      author = true;
    }

    // HACK - it seems we can't tell mongoose to select all but a given field,
    // so we'll forcefully remove the author field here.
    delete doc._doc.author;

    self.res.writeHead(200, headers);
    self.res.json({ status: 'ok', poem: doc, author: author });
  });
});

app.router.post('/save', function() {
  var self = this;
  if (typeof self.req.body.poem === 'undefined') {
    self.res.writeHead(400, headers);
    self.res.end(JSON.stringify({
      status: 'error',
      error: 'Missing or incomplete poem.'
    }));
    return;
  }

  app.savePoem(self.req.body.poem, function onSaved(err, poem, redirect) {
    if (err) {
      self.res.writeHead(err, headers);
      self.res.end(JSON.stringify({
        status: 'error',
        error: 'Error saving poem.'
      }));
      return;
    }

    if (typeof redirect === 'undefined') {
      redirect = false;
    }
    self.res.writeHead(200, headers);
    self.res.json({
      status: 'ok',
      poem: poem,
      redirect: redirect
    });
  });
});

app.router.post('/remove/:id', function(id) {
  var self = this;
  app.removePoem(id, function onRemoved(err) {
    if (err) {
      self.res.writeHead(500, headers);
      self.res.json({ status: 'error', error: 'Error removing poem.' });
      return;
    }
    self.res.writeHead(200, headers);
    self.res.json({ status: 'ok' });
  });
});

app.router.post('/update/:id', function(id) {
  var self = this;
  if (typeof self.req.body.oldAuthor === 'undefined' || typeof self.req.body.newAuthor === 'undefined') {
    self.res.writeHead(400);
    self.res.end();
    return;
  }
  app.updatePoemAuthor(id, self.req.body.oldAuthor, self.req.body.newAuthor, function(err) {
    if (err) {
      self.res.writeHead(500);
      self.res.end();
      return;
    }
    self.res.writeHead(200);
    self.res.end();
  });
});

app.start(settings.port);
