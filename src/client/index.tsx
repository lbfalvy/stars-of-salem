import React from "react";
import ReactDOM from "react-dom";

import { WsWrapper } from './WsWrapper';

import * as Sessions from '../shared/connection/sessions';
import * as Multiplexer from '../shared/connection/multiplexer';
import * as Interfaces from '../shared/connection/Interfaces';
import { buffer_to_arraybuffer } from "../shared/arrayBuffer";

import './index.css';

const address = 'ws://localhost:3000';
const client = new Sessions.Client(() => new Promise(res => {
    const ws = new WebSocket(address);
    ws.onopen = () => {
        res(new WsWrapper(ws));
    };
}));
client.broken_pipe.on(() => console.log('Reconnecting...'));
client.resuming.on(() => console.log('Connection restored'));
client.ready.then(() => {
    console.log('client ready');
    /*const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');
    const mux = new Multiplexer.Host.Host(client, {
        channel_factory: (conn, id) => new Multiplexer.Channel.Channel(conn, id, {
            encode: (data) => buffer_to_arraybuffer(encoder.encode(data)),
            decode: (data) => decoder.decode(data)
        })
    });
    mux.connection.once(conn => {
        console.log('first channel here');
        c1 = conn;
        mux.connection.once(conn => {
            console.log('second channel here');
            c2 = conn;
        });
    });*/
});

let c1:Interfaces.Connection;
let c2:Interfaces.Connection;

let a = '';
let b = '';
ReactDOM.render(<div>
    <input onChange={ev => a = ev.target.value}/>
    <input onChange={ev => b = ev.target.value}/>
    <button onClick={() => c1.send(a) && c2.send(b)}>Send</button>
    <button onClick={() => c1.close({code:3012, reason:'Quack quack quack'})}>Close</button>
</div>, document.getElementById("root"));