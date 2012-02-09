/**
 * @fileoverview MagPo server implementation.
 */

var flatiron = require('flatiron');
var settings = require('./local');
var app = flatiron.app;

// Define the default response headers.
var headers = {
  'Content-Type': 'application/json',
};

app.use(flatiron.plugins.http);
app.use(require('./plugins/magpo'));

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
  this.res.end(JSON.stringify({ status: 'ok' }));
});
app.router.get('/save', function() {
  this.res.writeHead(400, headers);
  this.res.end(JSON.stringify({
    status: 'error',
    error: 'Only POST requests are accepted.'
  }));
});

/**
 * POST routes.
 */
app.router.post('/load/:id', function(id) {
  var self = this;
  app.loadPoem(id, function onLoad(err, doc) {
    if (err) {
      console.error(err);
      self.res.writeHead(500, headers);
      self.res.end(JSON.stringify({ status: 'error', error: 'Error loading poem.' }));
      return;
    }
    self.res.writeHead(200, headers);
    self.res.end(JSON.stringify({ status: 'ok', poem: doc }));
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

  app.savePoem(self.req.body.poem, function onSaved(err, poem) {
    if (err) {
      console.error(err);
      self.res.writeHead(500, headers);
      self.res.end(JSON.stringify({
        status: 'error',
        error: 'Error saving poem.'
      }));
      return;
    }
    self.res.writeHead(200, headers);
    self.res.end(JSON.stringify({
      status: 'ok',
      poem: poem
    }));
  });
});
app.router.post('/remove/:id', function(id) {
  var self = this;
  app.removePoem(id, function onRemoved(err) {
    if (err) {
      console.error(err);
      self.res.writeHead(500, headers);
      self.res.end(JSON.stringify({ status: 'error', error: 'Error removing poem.' }));
      return;
    }
    self.res.writeHead(200, headers);
    self.res.end(JSON.stringify({ status: 'ok' }));
  });
});

app.start(settings.port);
