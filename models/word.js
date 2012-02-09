/**
 * @fileoverview Word model definition.
 */

/**
 * Type definition for Word model.
 */
var Word = {
  string: String,
  snap: String,
  row: Number,
  column: Number,
};

// If this is browser-side.
if (typeof module === 'undefined') {
  // Set usable defaults.
  Word.string = 'hello';
  Word.snap = 'none';
  Word.row = 0;
  Word.column = 0;
  if (typeof window.MagPo === 'undefined') {
    window.MagPo = { models: {} };
  }
  window.MagPo.models.Word = Word;
}
// Else export for use on server side.
else {
  module.exports = Word;
}

