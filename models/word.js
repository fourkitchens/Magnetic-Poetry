/**
 * @fileoverview Word model definition.
 */

/**
 * Type definition for Word model.
 */
var Word = {
  id: Number,
  vid: Number,
  string: String,
  snap: String,
  top: Number,
  left: Number,
};

// If this is browser-side.
if (typeof module === 'undefined') {
  // Set usable defaults.
  Word.id = 0;
  Word.vid = 0;
  Word.string = 'hello';
  Word.snap = 'none';
  Word.top = null;
  Word.left = null;
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

