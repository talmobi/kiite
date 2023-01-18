var fs = require( 'fs' )
var path = require( 'path' )

var puppeteer = require( 'puppeteer' )

var test = require( 'tape' )

var childProcess = require( 'child_process' )

var serverPath = path.join( __dirname, '../stage/server.js' )
var clientPath = path.join( __dirname, '../stage/client.js' )

var spawns = []

var server
var dave
var clive

var serverBuffer = []
var daveBuffer = []
var cliveBuffer = []

// cleanup
function killSpawns () {
  spawns.forEach( function ( spawn ) {
    try {
      spawn.kill()
    } catch ( err ) { /* ignore */ }
  } )
}

process.on( 'exit', killSpawns )

async function Sleep (ms) {
  return new Promise(function (res, rej) {
    setTimeout(function () {
      res()
    }, ms)
  })
}

test( 'chat messages', async function ( t ) {
  var _page

  ;await (async function () {
    const browser = await puppeteer.launch({
      headless: true
    });
    const page = await browser.newPage();

    spawnServer()
    spawnDave()
    spawnClive()

    await Sleep(3000)

    await page.goto('http://localhost:3456')
    _page = page
    console.log( 'page opened' )

    async function checkBrowserChat () {
      let data = await _page.evaluate(function () {
        return document.getElementById( 'chat' ).innerHTML
      })
      data = data.split( '&gt;' ).join( '>' )
      data = data.split( '&lt;' ).join( '<' )
      return data
    }

    server.stdin.write( 'hello everyone' )
    t.pass( 'server: hello everyone' )

    await Sleep(1000)
    dave.stdin.write( '/name dave\n' )
    t.pass( '/name dave' )
    clive.stdin.write( '/name clive\n' )
    t.pass( '/name clive' )

    await Sleep(1000)
    clive.stdin.write( 'im clive\n' )
    t.pass( 'clive: im clive' )

    await Sleep(1000)
    dave.stdin.write( 'im dave\n' )
    t.pass( 'dave: im dave' )

    await Sleep(1000)
    dave.stdin.write( '/w clive yo\n' )
    t.pass( '/w clive yo' )

    await Sleep(1000)
    dave.stdin.write( 'the end.' )
    t.pass( 'the end.' )

    await Sleep(3000)
    t.pass( 'checking browser' )
    killSpawns()

    await Sleep(1000)
    let text =  await checkBrowserChat()
    t.ok( text.indexOf( 'hello everyone' ) > 0, 'hello everyone' )
    t.ok( text.indexOf( 'clive: im clive' ) > 0, 'im clive' )
    t.ok( text.indexOf( 'dave: im dave' ) > 0, 'im dave' )
    t.ok( text.indexOf( 'dave: the end.' ) > 0, 'dave: the end' )
    console.log(text)
    t.ok( text.indexOf( '*dave*' ) === -1, 'dave hidden whisper' ) // whisper should not be visible

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

    await browser.close()
    t.end()
  })()

  console.log(' === end === ')
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

