Magnetic Poetry
===============

**Let's make something.**

This web app brings the fun of magnetic poetry to all of your devices. There's no app to install and everything is touch capable for phones and tablets. The best part is that you can create your own words and group them for fast and flexible poem creation.

It is built using [Backbone.js](http://backbonejs.org/), [Underscore.js](http://underscorejs.org/), [Require.js](http://requirejs.org/), [Node.js](http://nodejs.org/), and [MongoDB](http://www.mongodb.org/).

Demo: http://drupalpoetry.com (uses [Drupal](http://drupal.org/] a content manager)

Below is a slide deck that explains more about the technoligies and process that went into building the magnetic poetry web app.

http://fourkitchens.github.com/drupo-presentation

Server configuration
--------------------

The site should be served using nginx or another reverse proxy. Requests to /save, /load/\*, and /remove/\* should be proxied to the node server.

Node configuration
------------------

Update the server/local.js file to include appropriate database connection info and a port to listen on. Note: this port should be used when proxying responses to node.
