/**
 * @fileoverview Word model definition.
 */

/**
 * Type definition for Word model.
 */
var Word = {
  string: String,
  snap: String,
  position: Object,
};

// If this is browser-side.
if (typeof module === 'undefined') {
  // Set usable defaults.
  Word.string = 'hello';
  Word.snap = 'none';
  Word.position = {};
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

