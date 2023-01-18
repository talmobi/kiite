var fs = require( 'fs' )
var path = require( 'path' )

var http = require( 'http' )

// var kiite = require( '../src/index.js' )
var kiite = require( '../dist/kiite.min.js' )

var express = require( 'express' )
var app = express()

var server = http.createServer( app )

var io = kiite( server )

var names = {}

// app.use( '/kiite.min.js', function ( req, res ) {
//   res.sendFile( path.join( __dirname, '../dist/kiite.min.js' ) )
// } )

app.use( '/browser-client.js', function ( req, res ) {
  res.sendFile( path.join( __dirname, 'browser-client.js' ) )
} )

app.use( function ( req, res ) {
  res.sendFile( path.join( __dirname, 'index.html' ) )
} )

process.stdin.on( 'data', function ( chunk ) {
  // console.log( 'stdin chunk: ' + chunk )
  var text = chunk.toString( 'utf8' )

  io.emit( 'chat-message',
    '[ SERVER ]: ' + text
  )
} )

server.listen( 3456, function () {
  console.log( 'server listening at *:' + server.address().port )
} )

io.on( 'connection', function ( socket ) {
  console.log( 'NEW CLIENT CONNECTION [ ' + socket.ID + ' ]' )

  console.log( 'io.clientsConnected: ' + io.clientsConnected )
  console.log( 'Object.keys( io.clients ).length: ' + ( Object.keys( io.clients ) ).length )

  socket.broadcast( 'chat-message', ' >> ' + ( socket.ID ) + ' joined.' )
  // console.log( socket )
  socket.on( 'text', function ( text ) {
    if ( text.indexOf( '/' ) === 0 ) {
      // command
      var words = text.split( /\s+/ )
      var command = words[ 0 ]
      var args = words.slice( 1 )

      switch ( command ) {
        case '/name':
          var name = args[ 0 ]
          if ( socket.name ) {
            var msg = (
              'name change! ' + socket.name + ' is now known as [ ' + name + ' ]'
            )
            delete names[ socket.name ]
            names[ name ] = socket
            socket.name = name
            console.log( msg )
            socket.broadcast( 'chat-message', msg )
          } else {
            var msg = ( socket.ID + ' is now known as [ ' + name + ' ]' )
            names[ name ] = socket
            socket.name = name
            console.log( msg )
            socket.broadcast( 'chat-message', msg )
          }
        break

        case '/w':
          var from = socket.name
          if ( from ) {
            var toName = args[ 0 ]
            var toSocket = names[ toName ]
            if ( toSocket ) {
              var msg = (
                '*' + from + '*: ' +
                text.slice( text.indexOf( toName ) + toName.length + 1 )
              )
              toSocket.emit( 'chat-message', msg )
            } else {
              var msg = (
                'no user with that name found [ ' + toName + ' ]'
              )
              socket.emit( 'chat-message', msg )
            }
          } else {
            var msg = (
              'you must have a name before you can whisper!\n' +
              'set your name with "/name yourname"'
            )
            socket.emit( 'chat-message', msg )
          }
        break

        default:
          console.log( 'unkown command: ' + command )
      }

    } else {
      console.log( 'CLIENT MESSAGE: ' + text.trim() )
      socket.broadcast( 'chat-message',
        ( socket.name || socket.ID ) + ': ' + text
      )
    }
  } )

  socket.on( 'disconnect', function () {
    console.log( 'io.clientsConnected: ' + io.clientsConnected )
    console.log( 'Object.keys( io.clients ).length: ' + ( Object.keys( io.clients ) ).length )

    var name = socket.name
    socket.broadcast( 'chat-message', ' << ' + ( name || socket.ID ) + ' left.' )
    if ( name ) {
      delete names[ name ]
    }
  } )
} )
