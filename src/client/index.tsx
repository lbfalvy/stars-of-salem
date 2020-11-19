import React from "react";
import ReactDOM from "react-dom";

import { WsWrapper } from './WsWrapper';
import * as Sessions from '../shared/connection/sessions';
import * as Mux from '../shared/connection/multiplexer';
import { bufferToArrayBuffer } from "../shared/arrayBuffer";

import './index.css';
import AudIO from "./AudIO";
import ChannelResolver from "./ChannelResolver";
import { ChannelFactory } from "../shared/connection/multiplexer/Host";
import LoginForm from './LoginForm';

const ws_protocol = location.protocol.replace('http', 'ws'); // http => ws, https => wss
const address = `${ws_protocol}//${location.host}/api`;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');
const encode = (data:string) => bufferToArrayBuffer(encoder.encode(data));
const decode = (data:ArrayBuffer, offset?:number, length?:number) => {
    return decoder.decode(new Uint8Array(data, offset, length));
};
const chan_deps = { encode, decode };
const channelFactory:ChannelFactory = (conn, id) => new Mux.Channel.Channel(conn, id, chan_deps);
const mux_deps = { channelFactory };

async function connect(name:string, wsurl:string) {
    console.debug(wsurl);
    const client = new Sessions.Client(() => new Promise(res => {
        const ws = new WebSocket(wsurl);
        ws.onopen = () => res(new WsWrapper(ws));
    }));
    client.brokenPipe.on(() => console.log('Reconnecting...'));
    client.resuming.on(() => console.log('Connection restored'));
    client.ready.then(async () => {
        console.log('client ready');
        client.send(name);
        const mux = new Mux.Host.Host(client, mux_deps);
        const channels = new ChannelResolver(mux);
        channels.get('control').then(ctl => {
            ctl.message.on(data => console.log(data));
            console.log('Control channel here');
        });
        channels.get('voice').then(async voice => {
            console.log('Voice channel here');
            const props = await voice.message.next;
            if (typeof props !== 'string') {
                throw new Error('Didn\'t receive voice channel properties');
            }
            const { sampleRate, bufferSize } = JSON.parse(props);
            const duplex = await AudIO.create(sampleRate, bufferSize);
            duplex.gotFrame.on(blob => {
                voice.send(blob);
            });
            voice.message.on(msg => {
                if (typeof msg == 'string') {
                    throw new Error('String on voice channel');
                }
                duplex.playBuffer(msg);
            });
            console.log('Duplex audio initialized');
            window.addEventListener('close', () => {
                duplex.stopDataCallbacks();
                voice.terminate();
            });
        });
    });
    client.closed.then(() => console.log('damn'));
}

ReactDOM.render(<LoginForm onsubmit={
    data => connect(data.username, address)
} />, document.getElementById("root"));