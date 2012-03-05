/**
 * @fileoverview Defines breakpoint information that will be shared
 * between the client and server.
 */

if (typeof exports === 'undefined') {
  if (typeof window.MagPo === 'undefined') {
    window.MagPo = {};
  }
  var exp = window.MagPo.breakpoints = {};
}
else {
  var exp = module.exports = {};
}

/**
 * Defines desktop row height and char width.
 */
exp.desktop = {
  minWidth: null,
  maxWidth: null,
  rowHeight: 29,
  charWidth: 8
};

