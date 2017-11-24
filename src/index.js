Object.assign = require( 'object-assign' )

var kiite = require( './kiite.js' )
var client = require( './kiite-client.js' )

kiite.connect = client

module.exports = kiite
