var http = require( 'http' )
var kiite = require( './index.js' )

var express = require( 'express' )
var app = express()

var server = http.createServer( app )

var clientCounter = 0

var clients = {}

function emit ( evt, data ) {
  var ids = Object.keys( clients )
  ids.forEach( function ( id ) {
    var client = clients[ id ]
    client.buffer.push( {
      evt: evt,
      data: data
    } )

    flush( client )
  } )
}

function attach ( server ) {
  if ( typeof server === 'function' ) {
    var msg = (
      'You are probably trying to attach kiite.io to an express' +
      'middleware function. Pass in a http.Server instance.\n\n' +
      '  example: \n' +
      '  var app = require( "express" )()\n' +
      '  var srv = require( "http" ).createServer( app )\n' +
      '  var kiite = require( "kiite" )( srv )\n'
    )
    throw new Error( msg )
  }
  var url = '/kiite.io'
  var listeners = server.listeners( 'request' ).slice( 0 )
  var self = this
  server.removeAllListeners( 'request' )
  server.on( 'request', function ( req, res ) {
    if ( 0 === req.url.indexOf( url ) ) {
      handle( req, res )
    } else {
      for ( var i = 0; i < listeners.length; ++i ) {
        listeners[ i ].call( server, req, res )
      }
    }
  } )
}

attach( server )

app.use( function ( req, res ) {
  res.send( 'express' )
} )

// console.log( server )

// app.use( function ( req, res ) {
//   console.log( '[express]' )
//   res.statusCode = 200
//   res.write( 'express' )
//   res.end()
// } )

function handle ( req, res ) {
  console.log( '[middle], method: ' + req.method )

  var length = 0
  var body = []
  req.on( 'error', function ( err ) {
    console.error( err.stack )
  } )
  req.on( 'data', function ( chunk ) {
    length += chunk.length

    // TODO check for too long messages

    body.push( chunk )
  } )
  req.on( 'end', function () {
    body = Buffer.concat( body ).toString( 'utf8' )

    handleMessage( req, res, body )
  } )
}

function handleMessage ( req, res, body ) {
  try {
    var data = JSON.parse( body )

    var id = data.id

    // console.log( data )

    var client
    if ( typeof id === 'number' ) { // id OK
      client = clients[ data.id ]
    }

    if ( client ) {
      clearTimeout( client.DCTimeout )

      req.on( 'close', function () {
        // request closed unexpectedly
        // probably disconnected
        console.log( ' CLOSE ' )
        updateDCTimeout( client, 3000 )
      } )

      // existing client
      console.log( 'old client [ ' + id + ' ], evt: ' + data.evt )
      client.last_message_time = Date.now()

      if ( data.evt === 'longpoll' ) {
        if ( client.res ) {
          throw new Error( 'duplicate longpolls received from the same client' )
          // new longpoll received even after old is still active
          // -> delete and abort the old one
          // res.send( 200 ).json( { evt: 'stop' } ).end()
        }

        clearTimeout( client.resTimeout )
        client.res = res
        client.resTimeout = setTimeout( function () {
          console.log( 'requesting renew longpoll' )
          // longpoll timed out, tell the user to issue another longpoll
          // res.send( 200 ).json( { evt: 'timeout' } ).end()
          sendMessage(
            client.res,
            {
              evt: 'renew'
            }
          )
          delete client.res
        }, 1000 * 25 )

        flush( client )
      } else {
        console.log( 'unknown event: ' + data.evt )
        res.statusCode = 404
        res.end()
      }
    } else {
      // new client
      if ( data.evt === 'connect' ) {
        // wants to connect
        id = ( ++clientCounter )

        console.log( 'new client [ ' + id + ' ]' )

        client = {
          id: id,
          last_message_time: Date.now(),
          buffer: [],
          ua: req.headers[ 'user-agent' ]
        }

        updateDCTimeout( client )

        clients[ id ] = client

        sendMessage( res, {
          evt: 'connected',
          id: id
        } )
      } else {
        // unknown intentions -- unknown user
        console.log( '404 unknown user' )
        res.statusCode = 404
        res.end()
      }
    }
  } catch ( err ) {
    console.error( err.stack )
    // possibly failed to JSON.parse
    console.log( 'sending 400 Bad Request' )
    res.statusCode = 400
    res.write( '400 Bad Request' )
    res.end()
  }
}

function sendMessage ( res, data ) {
  res.statusCode = 200
  res.write( JSON.stringify( data ) )
  res.end()
}

server.listen( 3000, function () {
  console.log( 'server listening at *:' + server.address().port )
} )

// check if there are messages to the user and send them
function flush ( client ) {
  if ( client.buffer.length > 0 ) {
    if ( client.res ) { // able to send
      var messages = client.buffer.slice()
      client.buffer = []

      console.log( 'flushing messages: ' + messages.length + ', for client.id: ' + client.id )
      clearTimeout( client.resTimeout )

      sendMessage(
        client.res,
        {
          evt: 'flush',
          messages: messages
        }
      )
      delete client.res
    } else {
      // console.log( 'wanted to flush but no longpoll available' )
    }
  }
}

function updateDCTimeout ( client, ms ) {
  clearTimeout( client.DCTimeout )
  client.DCTimeout = setTimeout( function () {
    if ( client.res ) {
      // new longpoll received even after old is still active
      // -> delete and abort the old one
      client.res.statusCode = 444
      client.res.write( '444 Disconnected by server.' )
      client.res.end()
    }

    clearTimeout( client.resTimeout )
    console.log( ' >>> client disconnected: ' + client.id )
    delete clients[ client.id ]
  }, ms || ( 1000 * 30 ) )
}
