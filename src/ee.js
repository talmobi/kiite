module.exports = function () {
  var ee = {}

  var evts = {}

  ee.on = function ( evt, cb ) {
    var listeners = evts[ evt ]
    if ( !listeners ) {
      listeners = evts[ evt ] = []
    }

    listeners.push( cb )

    return function off () {
      var listeners = evts[ evt ]
      var i = listeners.indexOf( cb )
      if ( i >= 0 ) {
        return listeners.splice( i, 1 )
      }
    }
  }

  ee.once = function ( evt, cb ) {
    var off = ee.on( evt, function ( data ) {
      off()
      cb( data )
    } )
  }

  ee.emit = function ( evt, data ) {
    var listeners = evts[ evt ]

    if ( listeners ) {
      for ( var i = 0; i < listeners.length; ++i ) {
        listeners[ i ]( data )
      }
    }
  }

  ee.removeListeners = function ( evt ) {
    if ( evt ) {
      delete evt[ evt ]
    } else {
      Object.keys( evts ).forEach( function ( key ) {
        delete evts[ key ]
      } )
    }
  }

  ee.listeners = function ( evt ) {
    if ( evt ) {
      return evts[ evt ]
    } else {
      var l = []
      Object.keys( evts ).forEach( function ( key ) {
        var listeners = evts[ key ]
        l.concat( listeners )
      } )
      return l
    }
  }

  return ee
}
