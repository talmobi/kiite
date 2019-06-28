var req = require( 'dasu' ).req

var createEventEmitter = require( './ee.js' )

var LONGPOLL_TIMEOUT_COEFFICIENT = 1.30 // 30%

function debug () {
  // console.log.apply( this, arguments )
}

function verbose () {
  // console.log.apply( this, arguments )
}

module.exports = function connect ( _params ) {
  _params = _params || {}

  // this timeout is triggered only on special circumstances
  // when e.g. users computer goes to sleep and the response
  // from the server to the longpoll request will disappear
  // ( response from server is sent but never received by user code )
  // ( due to the computer being closed/asleep )
  // this leads to the problem that the client never reconnect
  // to the server once the users computer wakes up and becomes
  // responsive again ( because without this timeout the next longpoll is only
  // sent after a response from the server is received to the current
  // longpolling request )
  var _longpoll_timeout_time = ( 1000 * 25 * LONGPOLL_TIMEOUT_COEFFICIENT )
  var _longpoll_timeout = undefined

  var ee = createEventEmitter()

  // message buffer
  var _buffer = []

  var DEBOUNCE = 16
  var THROTTLE = 100

  var _flushTimeout
  var _flushTime = Date.now()

  var _closed = false

  // our user id given by the server
  var _ID

  // this is the functions return value
  var api = {
    on: ee.on,
    emit: function ( evt, data ) {
      _buffer.push( {
        evt: evt,
        data: data
      } )

      scheduleFlush()
    },
    clients: {},
    close: function () {
      _closed = true
      disconnect()
    }
  }

  function scheduleFlush () {
    clearTimeout( _flushTimeout )

    if ( _buffer.length > 0 ) {
      // check throttle
      var now = Date.now()
      var delta = ( now - _flushTime )
      if ( delta > THROTTLE ) {
        // too long has passed, flush immediately!
        flush()
        _flushTime = Date.now()
      } else {
        // we still have time to buffer/debounce
        _flushTimeout = setTimeout( function () {
          flush()
          _flushTime = Date.now()
        }, DEBOUNCE )
      }
    }
  }

  if ( typeof _params !== 'object' ) {
    var msg = (
      'kiite-client connect options must be of type "object"\n' +
      'eg: io({ host: "localhost", port: 3000 })\n' +
      'default to window.location.hostname and window.location.port\n' +
      'or localhost:80\n'
    )
    throw new Error( msg )
  }

  if ( typeof window === 'object' ) {
    var loc = {}

    if ( typeof window.location === 'object' ) {
      loc = window.location
    }

    var port = 80

    if ( loc.protocol && loc.protocol.indexOf( 'https' ) >= 0 ) port = 443

    _params.host = _params.host || loc.hostname || 'localhost'
    _params.port = _params.port || loc.port || port
  }

  // the root/main kiite endpoint -- all messages goes through here ( POST )
  _params.path = '/kiite.io'

  // only POST methods
  _params.method = 'POST'

  reconnect()

  function cpy ( a, b ) {
    var o = b || {}
    Object.keys( a ).forEach( function ( key ) {
      if ( o[ key ] == null ) {
        o[ key ] = a[ key ]
      }
    } )
    return o
  }

  function disconnect () {
    var params = cpy( _params )

    params.data = {
      ID: _ID,
      evt: 'disconnect'
    }

    debug( 'disconnecting' )
    req(
      params,
      function ( err, res, body ) { // eslint-disable-line handle-callback-err
        /* ignore */
      }
    )
  }

  function flush () {
    var params = cpy( _params )

    params.data = {
      ID: _ID,
      evt: 'messages',
      messages: _buffer
    }
    _buffer = []

    debug( 'flushing' )
    req(
      params,
      function ( err, res, body ) {
        if ( err ) {
          // let longpolling handle recovery
          debug( 'emit error' )
        } else {
          if ( res.status === 200 ) {
            // message sent OK
            debug( 'emit success' )
          } else {
            // let longpolling handle recovery
            debug( 'res.status error: ' + res.status )
          }
        }
      }
    )
  }

  function poll () {
    if ( _closed ) return

    var params = cpy( _params )

    params.data = {
      ID: _ID,
      evt: 'longpoll'
    }

    // this is set to true when the longpoll has been handled by the
    // _longpoll_timeout already; this should not happen usually since the
    // _longpoll_timeout should usually only trigger when we are highly certain
    // that a response from the server is never coming or has been lost due to
    // other cirumstances ( e.g. users computer in sleep mode when response is
    // sent from server )
    var _ignore_response = false

    // TODO add long poll response timeout
    // sometimes response disappears
    // (eg user client computer goes into sleep mode)
    // and is never able to reconnect because it's indefinitely
    // waiting for a longpolling response that never comes
    _longpoll_timeout = setTimeout( function longpoll_timeout () {
      // usually happens when user computer is asleep when a response to the
      // longpolling request is sent by the server
      debug( 'longpolling timed out' )

      reconnect()
    }, _longpoll_timeout_time )

    debug( 'longpolling' )
    req(
      params,
      function ( err, res, body ) {
        if ( _ignore_response ) return // handled already

        if ( err ) {
          // try to connect soon
          verbose( 'poll error, trying again in 1 sec' )

          ee.emit( 'disconnect' )
          ee.emit( 'disconnected' )
          verbose( 'disconnected by server' )

          // kill the _ID ( will reconnect )
          _ID = undefined

          setTimeout( function () {
            reconnect()
          }, 1000 )
        } else {
          if ( res.status === 200 ) {
            var data = JSON.parse( body )

            debug( 'longpoll evt: ' + data.evt )

            if ( data.LONGPOLL_TIMEOUT ) {
              _longpoll_timeout_time = data.LONGPOLL_TIMEOUT
            }

            switch ( data.evt ) {
              case 'renew':
                poll()
                break

              case 'messages':
                debug( 'got buffer.length: ' + data.messages.length )
                data.messages.forEach( function ( payload ) {
                  ee.emit( payload.evt, payload.data )
                } )
                poll()
                break

              default:
                poll()
            }
          } else {
            debug( 'res.status error: ' + res.status )

            switch ( res.status ) {
              case 444: // disconnected by server
                ee.emit( 'disconnect' )
                ee.emit( 'disconnected' )
                verbose( 'disconnected by server' )
                break

              case 404:
                // console.log( 'unkown user or unknown event' )
                break
            }

            // kill the _ID ( will reconnect )
            _ID = undefined

            setTimeout( function () {
              reconnect() // reconnect
            }, 1000 )
          }
        }
      }
    )
  }

  var _reconnectionTimeout = 1500
  function updateReconnectionTimeout () {
    _reconnectionTimeout += 150

    var maxTimeout = 2000
    var hidden = false

    if ( typeof document === 'object' ) {
      hidden = !!( document.hidden || document.msHidden || document.webkitHidden )
    }

    // slow polling if page is hidden
    if ( hidden ) {
      maxTimeout = 3000
    }

    if ( _reconnectionTimeout > maxTimeout ) {
      _reconnectionTimeout = maxTimeout
    }
  }

  function reconnect () {
    // kill the _ID ( will reconnect )
    _ID = undefined

    if ( _closed ) return

    var params = cpy( _params )

    params.data = { evt: 'connect' }

    debug( 'connecting' )
    req(
      params,
      function ( err, res, body ) {
        if ( err ) {
          // connection error, try again in 1 sec
          verbose( 'connection error, trying again in 1 sec' )

          updateReconnectionTimeout()

          setTimeout( function () {
            reconnect()
          }, _reconnectionTimeout )
        } else {
          if ( res.status === 200 ) {
            var data = JSON.parse( body )
            if ( data.evt === 'connected' && data.ID && data.ID.length > 5 ) {
              // reset reconnection timeout after a successful connection
              _reconnectionTimeout = 1500

              // connected successfully
              debug( data )
              _ID = data.ID

              if ( data.LONGPOLL_TIMEOUT ) {
                _longpoll_timeout_time = data.LONGPOLL_TIMEOUT
              }

              ee.emit( 'connect' )
              ee.emit( 'connected' )
              verbose( 'connected' )

              // start longpolling
              poll()
            } else {
              debug( 'unknown connect response' )
              debug( body )
            }
          }
        }
      }
    )
  }

  return api
}
