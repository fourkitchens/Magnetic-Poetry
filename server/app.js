/**
 * @fileoverview MagPo server implementation.
 */

var flatiron = require('flatiron');
var settings = require('./local');
var app = flatiron.app;

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
  this.res.writeHead(200, { 'Content-Type': 'application/json' });
  this.res.end(JSON.stringify({ status: 'ok' }));
});
app.router.get('/save', function() {
  this.res.writeHead(400, { 'Content-Type': 'application/json' });
  this.res.end(JSON.stringify({
    status: 'error',
    error: 'Only POST saves are accepted.'
  }));
});

/**
 * POST routes.
 */
app.router.post('/save', function() {
  if (typeof this.req.body.poem === 'undefined') {
    this.res.writeHead(400, { 'Content-Type': 'application/json' });
    this.res.end(JSON.stringify({
      status: 'error',
      error: 'Missing or incomplete poem.'
    }));
    return;
  }

  app.savePoem(this.req.body.poem, function onSaved(err, poem) {
    if (err) {
      console.error(err);
      this.res.writeHead(500, { 'Content-Type': 'application/json' });
      this.res.end(JSON.stringify({
        status: 'error',
        error: 'Error saving poem.'
      }));
      return;
    }
    this.res.writeHead(200, { 'Content-Type': 'application/json' });
    this.res.end(JSON.stringify({
      status: 'ok',
      poem: poem
    }));
  });
});

app.start(settings.port);
