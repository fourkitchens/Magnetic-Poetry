/**
 * @fileoverview Defines breakpoint information that will be shared
 * between the client and server.
 */

if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define({
  desktop: {
    minWidth: null,
    maxWidth: null,
    rowHeight: 29,
    charWidth: 8
  }
});
