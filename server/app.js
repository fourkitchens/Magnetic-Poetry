/**
 * @fileoverview MagPo server implementation.
 */

var flatiron = require('flatiron');
var app = flatiron.app;

app.use(flatiron.plugins.http);
app.use(require('./plugins/magpo'));

/**
 * POST routes.
 */
app.router.post('/save', function() {
  if (typeof this.req.body.poem === 'undefined') {
    this.res.writeHead(400, { 'Content-Type': 'application/json' });
    this.res.end(JSON.stringify({ error: 'Missing or incomplete poem.' });
    return;
  }
});
app.router.post('/save/:id', function(id) {
});
