var kiite = window.kiite

var io = kiite.connect( { port: 3000 } )

io.on( 'chat-message', function ( text ) {
  console.log( text )
} )
