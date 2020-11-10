import React from "react";
import ReactDOM from "react-dom";

import { WsWrapper } from './WsWrapper';
import * as Interfaces from '../shared/connection/Interfaces';
import * as Sessions from '../shared/connection/sessions';
import * as Multiplexer from '../shared/connection/multiplexer';
import { bufferToArrayBuffer } from "../shared/arrayBuffer";

import './index.css';
import { DuplexAudio } from "./Voip";
import { Disposable } from "../shared/TypedEvent";

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
    voice_channel = await mux.connection.next;
    console.log('second channel here');
});

let voice_channel: Interfaces.Connection;
let voice_io: DuplexAudio | undefined;
ReactDOM.render(<div>
    <button onClick={async () => {
        if (!voice_io) {
            voice_io = await DuplexAudio.create();
            voice_io.gotFrame.on(blob => {
                voice_channel.send(blob);
                //voice_io?.playBuffer(blob);
            });
        } else {
            voice_io.startDataCallbacks();
        }
        voice_channel.message.on(msg => {
            voice_io?.playBuffer(msg as ArrayBuffer);
        });
    }}>Join audio</button>
    <button onClick={() => {
        voice_io?.stopDataCallbacks();
    }}>Leave audio</button>
</div>, document.getElementById("root"));