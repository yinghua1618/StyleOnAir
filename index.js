const http = require( 'http' )
const fs = require( 'fs' )
const path = require( 'path' )
const WebSocket = require( 'ws' )
const url = require( 'url' )
const { debug } = require( 'console' )

const server = http.createServer( function ( req, res ) {
    if ( req.url === '/client.js' ) {
        fs.createReadStream( path.resolve( __dirname, "." + req.url ) ).pipe( res )
    } else {
        res.end()
    }
} )

function broadcast ( msg, sender ) {
    wss.clients.forEach( function each ( client ) {
        if ( client.readyState === WebSocket.OPEN && ( ( sender && client.acceptKey !== sender.acceptKey ) || !sender ) ) {
            client.send( msg )
        }
    } )
}

function parseMsg ( msg, sender ) {
    console.log( 'received: %s', msg )
    broadcast( msg, sender )
}


const wss = new WebSocket.Server( { noServer: true } )

wss.on( 'connection', function connection ( ws ) {
    ws.on( 'message', function incoming ( message ) {
        parseMsg( message, ws )
    } )
} )



server.on( 'upgrade', function upgrade ( request, socket, head ) {
    const pathname = url.parse( request.url ).pathname

    if ( pathname === '/soa' ) {
        wss.handleUpgrade( request, socket, head, function done ( ws ) {
            const acceptKey = request.headers[ 'sec-websocket-key' ]
            ws.acceptKey = acceptKey
            wss.emit( 'connection', ws, request )
        } )
    } else {
        socket.destroy()
    }
} )
debug( `Server on 8888` )
server.listen( 8888 )