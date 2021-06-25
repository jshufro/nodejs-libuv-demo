const http = require('http');

const requestListener = function ( req, res) {
  console.log(req.method, req.url);
  res.writeHead(200);
  res.end("{}");
}

const server = http.createServer(requestListener);
console.log("Listening on 8080");
server.listen(8080);
