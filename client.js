var req = require( 'dasu' ).req

function handleMessage ( data ) {
  var evt = dara.evt
}

function debug () {
  console.log.apply( this, arguments )
}

var _host = 'localhost'
var _port = 3000
var _path = '/kiite.io'

var _id

reconnect()

function poll () {
  var params = {
    method: 'POST',
    host: _host,
    path: _path,
    port: _port
  }

  params.data = {
    id: _id,
    evt: 'longpoll'
  }

  debug( 'longpolling' )
  req(
    params,
    function ( err, res, body ) {
      if ( err ) {
        // try to connect soon
        console.log( 'poll error, trying again in 1 sec' )
        setTimeout( function () {
          poll()
        }, 1000 )
      } else {
        if ( res.status === 200 ) {
          var data = JSON.parse( body )

          debug( 'longpoll evt: ' + data.evt )

          switch ( data.evt ) {
            case 'renew':
              poll()
              break

            case 'flush':
              console.log( 'got messages, length: ' + data.messages.length )
              console.log( data.messages[ 0 ] )
              poll()
              break

            default:
              poll()
          }
        } else {
          console.log( 'res.status error: ' + res.status )

          switch ( res.status ) {
            case 444: // disconnected by server
              console.log( 'disconnected by server' )

            case 404:
            default:
              _id = undefined
              connect() // reconnect
          }
        }
      }
    }
  )
}

function connect () {
  var params = {
    method: 'POST',
    host: _host,
    path: _path,
    data: { evt: 'connect' },
    port: _port
  }

  debug( 'connecting' )
  req(
    params,
    function ( err, res, body ) {
      if ( err ) console.log( err )

      if ( res.status === 200 ) {
        var data = JSON.parse( body )
        if ( data.evt === 'connected' && data.id >= 0 ) {
          console.log( 'connected: ' )
          console.log( data )
          _id = data.id
          // connected successfully
          poll()
        } else {
          console.log( 'unknown connect response')
          console.log( body )
        }
      }
    }
  )
}

function reconnect () {
  var params = {
    method: 'POST',
    host: _host,
    path: _path,
    data: { evt: 'connect' },
    port: _port
  }

  debug( 'connecting' )
  req(
    params,
    function ( err, res, body ) {
      if ( err ) {
        // connection error, try again in 1 sec
        console.log( 'connection error, trying again in 1 sec' )
        setTimeout( function () {
          reconnect()
        }, 1000 )
      } else {
        if ( res.status === 200 ) {
          var data = JSON.parse( body )
          if ( data.evt === 'connected' && data.id >= 0 ) {
            console.log( 'connected: ' )
            console.log( data )
            _id = data.id
            // connected successfully
            poll()
          } else {
            console.log( 'unknown connect response')
            console.log( body )
          }
        }
      }
    }
  )
}
