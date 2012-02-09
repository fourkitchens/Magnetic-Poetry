Magnetic Poetry
===============

Server configuration
--------------------

The site should be served using nginx or another reverse proxy. Requests to /save, /load/\*, and /remove/\* should be proxied to the node server.

Node configuration
------------------

Update the server/local.js file to include appropriate database connection info and a port to listen on. Note: this port should be used when proxying responses to node.
