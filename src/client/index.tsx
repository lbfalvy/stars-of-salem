import React from "react";
import ReactDOM from "react-dom";

import { WsWrapper } from './WsWrapper';

import * as Sessions from '../shared/connection/sessions';
import * as Multiplexer from '../shared/connection/multiplexer';
import { bufferToArrayBuffer } from "../shared/arrayBuffer";

import './index.css';

const address = 'ws://localhost:3000';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');
const client = new Sessions.Client(() => new Promise(res => {
    const ws = new WebSocket(address);
    ws.onopen = () => {
        res(new WsWrapper(ws));
    };
}));
client.brokenPipe.on(() => console.log('Reconnecting...'));
client.resuming.on(() => console.log('Connection restored'));
client.ready.then(async () => {
    console.log('client ready');
    const mux = new Multiplexer.Host.Host(client, {
        channelFactory: (conn, id) => new Multiplexer.Channel.Channel(conn, id, {
            encode: (data) => bufferToArrayBuffer(encoder.encode(data)),
            decode: (data) => decoder.decode(data)
        })
    });
    const _commands = await mux.connection.next;
    console.log('first channel here');
    const _voice = await mux.connection.next;
    console.log('second channel here');

});

const _a = '';
const _b = '';
ReactDOM.render(<div>
    <button onClick={() => {
        // Should join audio eventually
    }}>Join audio</button>
    <button onClick={() => {
        // Should leave audio eventually
    }}>Leave audio</button>
</div>, document.getElementById("root"));