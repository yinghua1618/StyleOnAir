( function () {
    function getDomPath ( el ) {
        var stack = []
        while ( el.parentNode != null ) {
            var sibCount = 0
            var sibIndex = 0
            for ( var i = 0; i < el.parentNode.childNodes.length; i++ ) {
                var sib = el.parentNode.childNodes[ i ]
                if ( sib.nodeName == el.nodeName ) {
                    if ( sib === el ) {
                        sibIndex = sibCount
                    }
                    sibCount++
                }
            }
            if ( el.hasAttribute( 'id' ) && el.id !== '' ) {
                stack.unshift( el.nodeName.toLowerCase() + '#' + el.id )
                // } else if ( el.className ) {
                //     stack.unshift( el.nodeName.toLowerCase() + '.' + el.className )
            } else if ( sibCount > 1 ) {
                // stack.unshift( el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')' )
                stack.unshift( el.nodeName.toLowerCase() + ':nth-child(' + ( sibIndex + 1 ) + ')' )
            } else {
                stack.unshift( el.nodeName.toLowerCase() )
            }
            el = el.parentNode
        }

        return stack.slice( 1 ) // removes the html element
    }

    function syncStyle ( msg ) {
        let json = JSON.parse( msg )
        switch ( json.act ) {
            case 'change_style':
            case 'change_class_name':
                let selector = json.selector || ''
                let target = null
                if ( selector ) {
                    target = document.querySelector( selector )
                }
                if ( target ) {
                    json.act === 'change_style' ? target.style.cssText = json.value : target.className = json.value
                } else {
                    console.warn( `Target not found for: ${ selector }` )
                }
                break
            case 'change_css_rule':
                break
        }

    }

    function connect () {
        var ws = new WebSocket( ws_url )
        ws.msg_list = []
        ws._send = ws.send
        ws.send = function ( msg ) {
            if ( disable_observer_on_received ) return
            if ( msg ) this.msg_list.push( msg )
            if ( ws.readyState !== WebSocket.OPEN ) {
                setTimeout( () => {
                    this.send()
                }, 100 )
            } else {
                let _msg = this.msg_list.shift()
                if ( _msg ) this._send( typeof _msg === 'string' ? _msg : JSON.stringify( _msg ) )

            }
        }

        ws.onopen = function () {

        }

        ws.onmessage = function ( e ) {
            console.log( 'Message:', e.data )
            disable_observer_on_received = true
            syncStyle( e.data )
        }

        ws.onclose = function ( e ) {
            console.log( 'Socket is closed. Reconnect will be attempted in 1 second.', e.reason )
            setTimeout( function () {
                connect()
            }, 1000 )
        }

        ws.onerror = function ( err ) {
            console.error( 'Socket encountered error: ', err.message, 'Closing socket' )
            ws.close()
        }

        return ws
    }

    function monitor_css () {
        if ( css_checking ) return
        css_checking = true
        for ( const sheet of document.styleSheets ) {
            let type = 'href'
            let target = ''
            if ( !sheet[ type ] ) {
                type = 'id'
                if ( !sheet.ownerNode.id ) {
                    type = ''
                }
            }
            if ( type ) {
                target = sheet[ type ]
                if ( target ) {
                    try {
                        if ( !css_cache[ type ] ) css_cache[ type ] = {}
                        if ( !css_cache[ type ][ target ] ) css_cache[ type ][ target ] = {}
                        let css_obj = css_cache[ type ][ target ]

                        for ( const rule of sheet.cssRules ) {
                            if ( css_obj[ rule.selectorText ] ) {
                                if ( css_obj[ rule.selectorText ] !== rule.style.cssText ) {
                                    let json = {
                                        act: 'change_css_rule',
                                        value: rule.style.cssText,
                                        selector: rule.selectorText,
                                        type_vale: target,
                                        type
                                    }
                                    if ( disable_observer_on_received ) {
                                        disable_observer_on_received = false
                                    } else {
                                        ws_client.send( json )
                                    }
                                    css_obj[ rule.selectorText ] = rule.style.cssText
                                }
                            } else {
                                css_obj[ rule.selectorText ] = rule.style.cssText
                            }

                        }
                    } catch ( e ) { }
                }

            }
        }
        css_checking = false
        // setTimeout( () => {
        //     monitor_css()
        // }, 100 )
    }

    function monitor_style () {

        let observer = new MutationObserver( function ( mutations ) {
            mutations.forEach( function ( mutationRecord ) {
                let json = null
                switch ( mutationRecord.attributeName ) {
                    case 'class':
                        json = {
                            act: 'change_class_name',
                            value: mutationRecord.target[ 'className' ],
                            selector: getDomPath( mutationRecord.target ).join( ' ' )
                        }
                        break
                    case 'style':
                        json = {
                            act: 'change_style',
                            value: mutationRecord.target[ mutationRecord.attributeName ].cssText,
                            selector: getDomPath( mutationRecord.target ).join( ' ' )
                        }
                        break
                }
                if ( json ) {
                    if ( disable_observer_on_received ) {
                        disable_observer_on_received = false
                    } else {
                        ws_client.send( json )
                    }

                }


                disable_observer_on_received = false

            } )
        } )

        observer.observe( document, {
            childList: true, attributes: true, attributeOldValue: true, attributeFilter: [ 'style', 'class' ],
            subtree: true
        } )
    }

    let myScript = document.currentScript,
        mySrc = myScript.getAttribute( 'src' )

    let url = new URL( mySrc )

    let ws_url = `ws://${ url.host }/soa`

    let ws_client = connect()

    let disable_observer_on_received = false

    let css_cache = {}
    let css_checking = false

    try {
        monitor_style()

        monitor_css()

    } catch ( e ) {

    }


}() ) 