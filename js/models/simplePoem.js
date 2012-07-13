/**
 * @fileoverview defines the simple poem model.
 */

if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define({
  id: null,
  author: '',
  poem: '',
  changed: null
});

