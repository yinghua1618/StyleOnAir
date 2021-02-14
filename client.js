(function (win) {


    function getDomPath(el) {
        var stack = []
        while (el.parentNode != null) {
            var sibCount = 0
            var sibIndex = 0
            for (var i = 0; i < el.parentNode.childNodes.length; i++) {
                var sib = el.parentNode.childNodes[i]
                if (sib.nodeName == el.nodeName) {
                    if (sib === el) {
                        sibIndex = sibCount
                    }
                    sibCount++
                }
            }
            if (el.hasAttribute('id') && el.id !== '') {
                stack.unshift(el.nodeName.toLowerCase() + '#' + el.id)
                // } else if ( el.className ) {
                //     stack.unshift( el.nodeName.toLowerCase() + '.' + el.className )
            } else if (sibCount > 1) {
                // stack.unshift( el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')' )
                stack.unshift(el.nodeName.toLowerCase() + ':nth-child(' + (sibIndex + 1) + ')')
            } else {
                stack.unshift(el.nodeName.toLowerCase())
            }
            el = el.parentNode
        }

        return stack.slice(1) // removes the html element
    }

    function syncStyle(msg) {
        try {
            let json = JSON.parse(msg)
            let selector = json.selector || ''
            let target = null
            if (selector) {
                target = document.querySelector(selector)
                if (!target) {
                    console.warn(`Target not found for: ${selector}`)
                    return
                }
            }
            switch (json.act) {
                case 'change_style':
                case 'change_class_name':
                    json.act === 'change_style' ? target.style.cssText = json.value : target.className = json.value
                    break
                case 'change_css_rule':
                    if (json.ruleIdx) {
                        let cssRule = document.styleSheets[json.ruleIdx[0]].cssRules[json.ruleIdx[1]]
                        cssRule.style.cssText = json.value
                    }
                    break
                case 'evt_click':
                    target.click()
                    break
            }

        } catch (e) {
            console.error(e)
        }

    }

    function connect() {
        var ws = new WebSocket(ws_url)
        ws.msg_list = []
        ws._send = ws.send
        ws.send = function (msg) {
            if (status !== 'start') return
            if (disable_observer_on_received) return
            if (msg) this.msg_list.push(msg)
            if (ws.readyState !== WebSocket.OPEN) {
                setTimeout(() => {
                    this.send()
                }, 100)
            } else {
                let _msg = this.msg_list.shift()
                if (_msg) this._send(typeof _msg === 'string' ? _msg : JSON.stringify(_msg))

            }
        }

        ws.onopen = function () {

        }

        ws.onmessage = function (e) {
            console.log('Message:', e.data)
            if (status !== 'start') return
            disable_observer_on_received = true
            syncStyle(e.data)
        }

        ws.onclose = function (e) {
            console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason)
            setTimeout(function () {
                connect()
            }, 1000)
        }

        ws.onerror = function (err) {
            console.error('Socket encountered error: ', err.message, 'Closing socket')
            ws.close()
        }

        return ws
    }

    function monitor_css() {
        if (css_checking) return
        css_checking = true
        let s_idx = 0
        for (const sheet of document.styleSheets) {
            try {
                if (!css_cache[s_idx]) css_cache[s_idx] = {}
                let css_obj = css_cache[s_idx]

                let r_idx = 0
                for (const rule of sheet.cssRules) {
                    if (css_obj[r_idx]) {
                        if (css_obj[r_idx] !== rule.style.cssText) {
                            let json = {
                                act: 'change_css_rule',
                                value: rule.style.cssText,
                                ruleIdx: [s_idx, r_idx],
                                selectorText: rule.selectorText
                            }
                            if (disable_observer_on_received) {
                                disable_observer_on_received = false
                            } else {
                                ws_client.send(json)
                            }
                            css_obj[r_idx] = rule.style.cssText
                        }
                    } else {
                        css_obj[r_idx] = rule.style.cssText
                    }
                    r_idx++
                }
            } catch (e) { }
            s_idx++
        }
        css_checking = false
        setTimeout(() => {
            monitor_css()
        }, 100)
    }

    function monitor_style() {

        let observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutationRecord) {
                let json = null
                if (mutationRecord.target.id.indexOf(dom_id) !== 0) {
                    switch (mutationRecord.attributeName) {
                        case 'class':
                            json = {
                                act: 'change_class_name',
                                value: mutationRecord.target['className'],
                                selector: getDomPath(mutationRecord.target).join(' ')
                            }
                            break
                        case 'style':
                            json = {
                                act: 'change_style',
                                value: mutationRecord.target[mutationRecord.attributeName].cssText,
                                selector: getDomPath(mutationRecord.target).join(' ')
                            }
                            break
                    }
                    if (json) {
                        if (disable_observer_on_received) {
                            disable_observer_on_received = false
                        } else {
                            ws_client.send(json)
                        }

                    }
                    disable_observer_on_received = false
                }

            })
        })

        observer.observe(document, {
            childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['style', 'class'],
            subtree: true
        })
    }

    function monitor_event(event) {
        if (event.target.id.indexOf(dom_id) !== 0) {
            let json = {
                act: 'evt_click',
                value: '',
                selector: getDomPath(event.target).join(' ')
            }
            if (disable_observer_on_received) {
                disable_observer_on_received = false
            } else {
                ws_client.send(json)
            }
            disable_observer_on_received = false
        }

    }
    function showOption() {
        let dom = document.querySelector(`#${dom_id}`)
        if (dom.style.width) {
            dom.style.width = ''
            dom.style.height = ''
        } else {
            dom.style.width = '100vw'
            dom.style.height = '100vh'
        }
    }

    function init() {
        let dom = document.querySelector(`#${dom_id}`)
        if (!dom) {
            dom = document.createElement('div')
            dom.id = dom_id
            dom.style = `
            position: fixed;
            right: 0;
            bottom: 0;`
            dom.innerHTML = `<div id="${dom_id}TITLE" style="color: yellow;text-shadow: 0px 1px 1px black;position: fixed;bottom: 0;right: 0;">SOA</div>
            <div id="${dom_id}PANEL" style="
            width: 100vw;
            height: 100vh;
            position: absolute;
            top: 0;
            left: 0;
            background-color: rgba(0,0,0,.25);
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            ">
                <div>
                    <div id="${dom_id}BTN" style="text-shadow: 0 1px white;padding: 20px 30px;">Start</div>
                </div>
                <div>
                    <label style="display: flex;text-shadow: 0 1px white;">Sync Click Event<input type="checkbox" value="1" id="${dom_id}EVT"></label>
                </div>

            </div>`
            document.body.appendChild(dom)
            dom.addEventListener('click', () => {
                showOption()
            })
            document.querySelector(`#${dom_id}EVT`).addEventListener('click', (evt) => {
                if (evt.target.checked) {
                    win.addEventListener("click", monitor_event)
                } else {
                    win.removeEventListener('click', monitor_event)
                }
            })
            document.querySelector(`#${dom_id}BTN`).addEventListener('click', (evt) => {
                if (status === 'pause') {
                    status = 'start'
                    document.querySelector(`#${dom_id}BTN`).innerHTML = 'Pause'
                    document.querySelector(`#${dom_id}TITLE`).style.color = 'lightgreen'
                } else {
                    status = 'pause'
                    document.querySelector(`#${dom_id}BTN`).innerHTML = 'Start'
                    document.querySelector(`#${dom_id}TITLE`).style.color = 'yellow'
                }
            })
        }
    }

    let myScript = document.currentScript,
        mySrc = myScript.getAttribute('src')

    let url = new URL(mySrc)

    let dom_id = '__SOA__'

    let ws_url = `ws://${url.host}/soa`

    let ws_client = connect()

    let disable_observer_on_received = false

    let css_cache = {}
    let css_checking = false

    let status = 'pause'

    try {
        win.addEventListener('load', (evt) => {
            init()
            monitor_style()
            monitor_css()
        })

    } catch (e) {
        console.log(e)
    }


}(window)) 