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
});
app.router.post('/save/:id', function(id) {
});
