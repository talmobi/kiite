var createEventEmitter = require( './ee.js' )
var cuid = require( 'cuid' )

var LONGPOLL_TIMEOUT = ( 1000 * 25 )
var DC_TIMEOUT = ( 1000 * 30 )

function debug () {
  // console.log.apply( this, arguments )
}

module.exports = function ( server ) {
  attach( server )

  var ee = createEventEmitter()

  // this is the functions return value
  var api = {
    on: ee.on,
    emit: function ( evt, data ) {
      emitAll( evt, data )
    },
    clients: {}
  }

  function emitAll ( evt, data, exceptID ) {
    debug( 'emitting all' )
    var IDs = Object.keys( api.clients )
    IDs.forEach( function ( ID ) {
      if ( ID !== exceptID ) {
        var client = api.clients[ ID ]

        client.buffer.push( {
          evt: evt,
          data: data
        } )

        flush( client )
      } else {
        debug( 'exceptID: ' + exceptID )
      }
    } )
  }

  function emit ( client, evt, data ) {
    client.buffer.push( {
      evt: evt,
      data: data
    } )

    flush( client )
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
    server.removeAllListeners( 'request' )
    server.on( 'request', function ( req, res ) {
      if ( req.url.indexOf( url ) === 0 ) {
        // handle cors and preflights
        // ref: https://gist.github.com/nilcolor/816580
        if ( req.method === 'OPTIONS' ) {
          var headers = {}
          headers[ 'Access-Control-Allow-Origin' ] = '*'
          headers[ 'Access-Control-Allow-Methods' ] = 'POST, GET, PUT, DELETE, OPTIONS'
          headers[ 'Access-Control-Allow-Credentials' ] = false
          headers[ 'Access-Control-Max-Age' ] = '86400' // 24 hours
          headers[ 'Access-Control-Allow-Headers' ] = 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept'
          res.writeHead( 200, headers )
          res.end()
        } else {
          res.setHeader( 'Access-Control-Allow-Origin', '*' )
          handleRequest( req, res )
        }
      } else {
        for ( var i = 0; i < listeners.length; ++i ) {
          listeners[ i ].call( server, req, res )
        }
      }
    } )
  }

  function handleRequest ( req, res ) {
    debug( '[middle], method: ' + req.method )

    var length = 0 // eslint-disable-line no-unused-vars
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

      var ip = req.connection.remoteAddress
      var ua = req.headers[ 'user-agent' ]

      var ID = data.ID

      debug( data )

      var client
      if ( typeof ID === 'string' ) {
        client = api.clients[ data.ID ]
      } else {
        debug( 'ID was not a string' )
      }

      if ( client ) {
        if ( client.ip !== ip ) {
          debug( 'ip mismatch' )
          // TODO opts hook?
        }

        if ( client.ua !== ua ) {
          debug( 'ua mismatch' )
          // TODO opts hook?
        }

        updateDCTimeout( client )

        req.on( 'close', function () {
          // request closed unexpectedly
          // probably disconnected
          debug( ' CLOSE ' )

          if ( data.evt === 'longpoll' ) {
            updateDCTimeout( client, 1500 )
          }
        } )

        // existing client
        debug( 'old client [ ' + ID + ' ], evt: ' + data.evt )
        client.last_message_time = Date.now()

        switch ( data.evt ) {
          case 'disconnect':
            console.log( 'disconnect evt ' )
            updateDCTimeout( client, 1 )
            break

          case 'longpoll':
            if ( client.longpollResponse ) {
              throw new Error( 'duplicate longpolls received from the same client' )
              // new longpoll received even after old is still active
              // -> delete and abort the old one
              // res.send( 200 ).json( { evt: 'stop' } ).end()
            }

            clearTimeout( client.longpollResponseTimeout )
            client.longpollResponse = res
            client.longpollResponseTimeout = setTimeout( function () {
              debug( 'requesting renew longpoll' )
              // longpoll timed out, tell the user to issue another longpoll
              // res.send( 200 ).json( { evt: 'timeout' } ).end()
              sendMessage(
                client.longpollResponse,
                {
                  evt: 'renew'
                }
              )
              delete client.longpollResponse
            }, LONGPOLL_TIMEOUT )

            flush( client )
            break

          case 'messages':
            handleClientMessages( client, res, data.messages )
            break

          default:
            debug( 'unknown event: ' + data.evt )
            debug( body )
            res.statusCode = 404
            res.end()
        }
      } else {
        // new client
        if ( data.evt === 'connect' ) {
          // wants to connect
          ID = cuid()

          debug( 'new client [ ' + ID + ' ]' )
          debug( 'new client ip: ' + ip )

          client = {
            ID: ID,
            ip: ip,
            ua: ua,
            last_message_time: Date.now(),
            buffer: [],
            request: req
          }

          updateDCTimeout( client )

          api.clients[ ID ] = client

          sendMessage( res, {
            evt: 'connected',
            ID: ID
          } )

          var socket = createEventEmitter()
          client.socket = socket

          var socketApi = {
            ID: client.ID,
            on: socket.on,
            emit: function ( evt, data ) {
              emit( client, evt, data )
            },
            broadcast: function ( evt, data ) {
              // send to all except this socket
              emitAll( evt, data, client.ID )
            },
            request: req
          }

          ee.emit( 'connect', socketApi )
          ee.emit( 'connection', socketApi )
        } else {
          // unknown intentions -- unknown user
          debug( '404 unknown user' )
          debug( body )
          res.statusCode = 404
          res.end()
        }
      }
    } catch ( err ) {
      console.error( err.stack )
      // possibly failed to JSON.parse
      debug( 'sending 400 Bad Request' )
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

  function handleClientMessages ( client, res, messages ) {
    res.statusCode = 200
    res.end()

    for ( var i = 0; i < messages.length; ++i ) {
      client.socket.emit(
        messages[ i ].evt,
        messages[ i ].data
      )
    }
  }

  // check if there are messages to the user and send them
  function flush ( client ) {
    if ( client.buffer.length > 0 ) {
      if ( client.longpollResponse ) { // able to send
        var buffer = client.buffer
        client.buffer = []

        debug( 'flushing buffer.length: ' + buffer.length + ', for client.ID: ' + client.ID )
        clearTimeout( client.longpollResponseTimeout )

        sendMessage(
          client.longpollResponse,
          {
            evt: 'messages',
            messages: buffer
          }
        )
        delete client.longpollResponse
      } else {
        // debug( 'wanted to flush but no longpoll available' )
      }
    }
  }

  function updateDCTimeout ( client, ms ) {
    clearTimeout( client.DCTimeout )
    client.DCTimeout = setTimeout( function () {
      if ( client.longpollResponse ) {
        // new longpoll received even after old is still active
        // -> delete and abort the old one
        client.longpollResponse.statusCode = 444
        client.longpollResponse.write( '444 Disconnected by server.' )
        client.longpollResponse.end()
      }

      clearTimeout( client.longpollResponseTimeout )
      debug( ' >>> client disconnected: ' + client.ID )
      client.socket.emit( 'disconnect' )
      delete api.clients[ client.ID ]
    }, ms || ( DC_TIMEOUT ) )
  }

  return api
}
