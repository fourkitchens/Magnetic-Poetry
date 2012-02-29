/**
 * @fileoverview Word model definition.
 */

/**
 * Type definition for Word model.
 */
var Word = {
  id: 0,
  vid: 0,
  string: '',
  top: null,
  left: null,
};

// If this is browser-side.
if (typeof module === 'undefined') {
  if (typeof window.MagPo === 'undefined') {
    window.MagPo = { models: {} };
  }
  else if (typeof window.MagPo.models === 'undefined') {
    window.MagPo.models = {};
  }
  window.MagPo.models.Word = Word;
}
// Else export for use on server side.
else {
  module.exports = Word;
}

