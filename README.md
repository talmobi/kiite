[![npm](https://img.shields.io/npm/v/kiite.svg?maxAge=3600&style=flat-square)](https://www.npmjs.com/package/kiite)
[![npm](https://img.shields.io/npm/dm/kiite.svg?maxAge=3600&style=flat-square)](https://www.npmjs.com/package/kiite)
[![npm](https://img.shields.io/npm/l/kiite.svg?maxAge=3600&style=flat-square)](https://github.com/talmobi/kiite/blob/master/LICENSE)

#  聞いて kiite 📞
simple long polling server and client

## Easy to use

#### Server
```js
var http = require( 'http' )
var server = http.createServer()

var kiite = require( 'kiite' )
var io = kiite( server )

io.on( 'connection', function ( socket ) {
  console.log( 'client connected! ' + io.clientsConnected )

  var name = 'anon' + Math.floor( Math.random() * 1000 )

  socket.emit( 'message', '[SERVER]: Welcome, ' + name + '!' )
  socket.broadcast( 'message', '[SERVER]: ' + name + ' joined.' )

  socket.on( 'message', function ( message ) {
    socket.broadcast( 'message', name + ': ' + message )
  } )

  socket.on( 'disconnect', function () {
    console.log( 'client disconnected. ' + io.clientsConnected )
  } )
} )

server.listen( 9090, function () {
  console.log( 'server listening at *:' + server.address().port )
} )
```

#### Client
```html
<body>
  <h2>Kiite client</h2>
  <input type="text" id="input">
  <ul id="list"></ul>
  <script src="kiite.min.js" type="text/javascript"></script>
  <script type="text/javascript">
    var io = window.kiite.connect( { port: 9090 } )

    io.on( 'message', function ( text ) {
      var el = document.createElement( 'li' )
      el.innerHTML = text.trim()
      list.appendChild( el )
    } )

    input.focus()
    input.onkeyup = function ( evt ) {
      if ( evt.keyCode == 13 ) {
        io.emit( 'message', input.value )
        input.value = ''
      }
    }
  </script>
</body>
```

## About
Small, quick, and easy sockets/longpolling for simple needs with no external dependencies, binaries or GYP rebuilds.

## Why
Other rich solutions can be too bulky to justify their use for very simple needs with long downloads, install times, rebuilds, and may have cross platform inconsistencies.

## How
Basic HTTP longpolling.

## Alternatives
[socket.io](https://github.com/socketio/socket.io)

[socket.io-client](https://github.com/socketio/socket.io-client)

## Test
```bash
npm test
```
