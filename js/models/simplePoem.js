/**
 * @fileoverview defines the simple poem model.
 */

/**
 * Type definition for the simple poem model.
 */
var SimplePoem = {
  id: null,
  author: '',
  poem: '',
  changed: null
};

// Export the definition.
if (typeof module === 'undefined') {
  // Set usable defaults.
  if (typeof window.MagPo === 'undefined') {
    window.MagPo = { models: {} };
  }
  else if (typeof window.MagPo.models === 'undefined') {
    window.MagPo.models = {};
  }
  window.MagPo.models.SimplePoem = SimplePoem;
}
else {
  module.exports = SimplePoem;
}

