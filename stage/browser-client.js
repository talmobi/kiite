var kiite = window.kiite

var io = kiite.connect( { port: 3000 } )

var buffer = ''

var chat = document.getElementById( 'chat' )

io.on( 'chat-message', function ( text ) {
  buffer += text

  if ( buffer[ buffer.length - 1 ] !== '\n' ) buffer += '\n'

  chat.innerHTML = buffer
} )
