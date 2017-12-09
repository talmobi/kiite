var fs = require( 'fs' )
var http = require( 'http' )

var server = http.createServer( function ( req, res ) {
  // TIP! use expressjs as server middleware!
  if ( req.url.indexOf( 'kiite.min.js' ) >= 0 ) {
    res.writeHead( 200, { 'content-type': 'text/javascript' } )
    return fs.createReadStream( 'kiite.min.js' ).pipe( res )
  }
  res.writeHead( 200, { 'content-type': 'text/html' } )
  return fs.createReadStream( 'index.html' ).pipe( res )
} )

var kiite = require( './kiite.min.js' )
var io = kiite( server )

io.on( 'connection', function ( socket ) {
  console.log( 'client connected! ' + io.clientsConnected )

  var name = 'anon' + Math.floor( Math.random() * 1000 )

  socket.emit( 'message', '[SERVER]: Welcome, ' + name + '!' )
  socket.broadcast( 'message', '[SERVER]: ' + name + ' joined.' )

  socket.on( 'message', function ( message ) {
    console.log( name + ': ' + message )
    io.emit( 'message', name + ': ' + message )
  } )

  socket.on( 'disconnect', function () {
    console.log( 'client disconnected. ' + io.clientsConnected )
    socket.broadcast( 'message', '[SERVER]: ' + name + ' left.' )
  } )
} )

server.listen( 9090, function () {
  console.log( 'server listening at *:' + server.address().port )
} )
