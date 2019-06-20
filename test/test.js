var fs = require( 'fs' )
var path = require( 'path' )

var pinkyjs = require( 'pinkyjs' )

var test = require( 'tape' )

var childProcess = require( 'child_process' )

var serverPath = path.join( __dirname, '../stage/server.js' )
var clientPath = path.join( __dirname, '../stage/client.js' )

var spawns = []

var _page

var server
var dave
var clive

var serverBuffer = []
var daveBuffer = []
var cliveBuffer = []

var pinky = pinkyjs.createSpawn()
pinky.createPage({
  viewportSize: {
    width: 720,
    height: 1280
  },
  settings: {
    loadImages: false
  }
}, function ( err, page ) {
  if ( err ) throw err

  _page = page

  page.open( 'http://localhost:3456', function ( err ) {
    if ( err ) throw err
    console.log( 'page opened' )
  } )
} )

function checkPinky ( callback ) {
  _page.eval(
    function () {
      return document.getElementById( 'chat' ).innerHTML
    },
    function ( err, data ) {
      if ( err ) throw err
      data = data.split( '&gt;' ).join( '>' )
      data = data.split( '&lt;' ).join( '<' )
      callback( data )
    }
  )
}

// cleanup
function killAll () {
  spawns.forEach( function ( spawn ) {
    try {
      spawn.kill()
    } catch ( err ) { /* ignore */ }
  } )
}

process.on( 'exit', killAll )


test( 'chat messages', function ( t ) {
  spawnServer()
  spawnDave()
  spawnClive()

  setTimeout( function () {
    server.stdin.write( 'hello everyone' )
    t.pass( 'server: hello everyone' )

    setTimeout( function () {
      dave.stdin.write( '/name dave\n' )
      t.pass( '/name dave' )
      clive.stdin.write( '/name clive\n' )
      t.pass( '/name clive' )

      setTimeout( function () {
        clive.stdin.write( 'im clive\n' )
        t.pass( 'clive: im clive' )

        setTimeout( function () {
          dave.stdin.write( 'im dave\n' )
          t.pass( 'dave: im dave' )

          setTimeout( function () {
            dave.stdin.write( '/w clive yo\n' )
            t.pass( '/w clive yo' )

            setTimeout( function () {
              dave.stdin.write( 'the end.' )
              t.pass( 'the end.' )

              setTimeout( function () {
                t.pass( 'checking pinkyjs ( headless browser )' )
                checkPinky( function ( text ) {
                  killAll()
                  pinky.exit()

                  // check pinkyjs
                  t.ok( text.indexOf( 'hello everyone' ) > 0 )
                  t.ok( text.indexOf( 'clive: im clive' ) > 0 )
                  t.ok( text.indexOf( 'dave: im dave' ) > 0 )
                  t.ok( text.indexOf( 'dave: the end.' ) > 0 )
                  t.ok( text.indexOf( '*dave*' ) === -1 ) // whisper should not be visible

                  // check server
                  text = serverBuffer.join( '\n' )

                  t.ok( text.indexOf( 'io.clientsConnected: 1' ) > 0 )
                  t.ok( text.indexOf( 'Object.keys( io.clients ).length: 1' ) > 0 )

                  t.ok( text.indexOf( 'io.clientsConnected: 2' ) > 0 )
                  t.ok( text.indexOf( 'Object.keys( io.clients ).length: 2' ) > 0 )

                  t.ok( text.indexOf( 'io.clientsConnected: 3' ) > 0 )
                  t.ok( text.indexOf( 'Object.keys( io.clients ).length: 3' ) > 0 )

                  t.ok( text.indexOf( 'CLIENT MESSAGE: im clive' ) > 0 )
                  t.ok( text.indexOf( 'CLIENT MESSAGE: im dave' ) > 0 )
                  t.ok( text.indexOf( 'CLIENT MESSAGE: the end.' ) > 0 )
                  t.ok( text.indexOf( '*dave*' ) === -1 ) // whisper should not be visible

                  // check clive
                  text = cliveBuffer.join( '\n' )
                  t.ok( text.indexOf( 'hello everyone' ) > 0 )
                  t.ok( text.indexOf( 'clive: im clive' ) === -1 ) // can't see own messages
                  t.ok( text.indexOf( 'dave: im dave' ) > 0 )
                  t.ok( text.indexOf( 'dave: the end.' ) > 0 )
                  t.ok( text.indexOf( '*dave*: yo' ) > 0 ) // whisper visible for clive

                  text = daveBuffer.join( '\n' )
                  t.ok( text.indexOf( 'hello everyone' ) > 0 )
                  t.ok( text.indexOf( 'clive: im clive' ) > 0 )
                  t.ok( text.indexOf( 'dave: im dave' ) === -1 ) // can't see own messages
                  t.ok( text.indexOf( 'dave: the end.' ) === -1 ) // can't see own messages
                  t.ok( text.indexOf( '*dave*' ) === -1 ) // whisper should not be visible

                  t.pass( 'exiting...' )
                  t.end()
                } )
              }, 3000 )
            }, 1000 )
          }, 1000 )
        }, 1000 )
      }, 1000 )
    }, 1000 )
  }, 5000 )
} )

function spawnServer () {
  var spawn = childProcess.spawn( 'node', [ serverPath ] )
  spawns.push( spawn )

  server = spawn

  spawn.on( 'exit', function () {
    console.log( 'spawn exited' )
  } )

  spawn.stdout.on( 'data', function ( chunk ) {
    var text = chunk.toString()
    console.log( text )
    serverBuffer.push( text )
  } )

  spawn.stderr.on( 'data', function ( chunk ) {
    var text = chunk.toString()
    console.log( text )
  } )
}

function spawnDave () {
  var spawn = childProcess.spawn( 'node', [ clientPath ] )
  spawns.push( spawn )

  dave = spawn

  spawn.on( 'exit', function () {
    console.log( 'spawn exited' )
  } )

  spawn.stdout.on( 'data', function ( chunk ) {
    var text = chunk.toString()
    daveBuffer.push( text )
  } )

  spawn.stderr.on( 'data', function ( chunk ) {
    var text = chunk.toString()
    console.log( text )
  } )
}

function spawnClive () {
  var spawn = childProcess.spawn( 'node', [ clientPath ] )
  spawns.push( spawn )

  clive = spawn

  spawn.on( 'exit', function () {
    console.log( 'spawn exited' )
  } )

  spawn.stdout.on( 'data', function ( chunk ) {
    var text = chunk.toString()
    console.log( text )
    cliveBuffer.push( text )
  } )

  spawn.stderr.on( 'data', function ( chunk ) {
    var text = chunk.toString()
    console.log( text )
  } )
}
