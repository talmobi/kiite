var kiite = require( '../dist/kiite.min.js' )
var io = kiite.connect( { port: 3000 } )

io.on( 'chat-message', function ( text ) {
  console.log( text.trim() )
} )

process.stdin.on( 'data', function ( chunk ) {
  // console.log( 'stdin chunk: ' + chunk )
  var text = chunk.toString( 'utf8' )

  io.emit( 'text', text )
} )
