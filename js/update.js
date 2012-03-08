/**
 * @fileoverview Updates poems by a given user.
 */

self.onmessage = function(event) {
  // Update any existing poems by this user.
  var req = new XMLHttpRequest();
  var data = JSON.stringify({
    id: event.data.id,
    oldAuthor: event.data.oldAuthor,
    newAuthor: event.data.newAuthor,
  });
  req.open('POST', event.data.callback, false);
  req.setRequestHeader('Content-Type', 'application/json');
  req.send(data);

  if (req.status !== 200) {
    self.postMessage(req.status);
  }
};

