import { WsWrapper } from './WsWrapper';
import * as Sessions from '../shared/connection/sessions';
import * as Mux from '../shared/connection/multiplexer';
import { bufferToArrayBuffer } from "../shared/arrayBuffer";

import ChannelResolver from "./ChannelResolver";
import { ChannelFactory } from "../shared/connection/multiplexer/Host";
import LoginForm, { Details as LoginDetails } from './LoginForm';
import React from 'react';
import ReconnectingOverlay from './ReconnectingOverlay';
import { Game } from './Game';
import VoiceLink from './VoiceLink';

// DI stuff
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');
const encode = (data: string) => bufferToArrayBuffer(encoder.encode(data));
const decode = (data: ArrayBuffer, offset?: number, length?: number) =>
    decoder.decode(new Uint8Array(data, offset, length));
const chan_deps = { encode, decode };
const channelFactory: ChannelFactory = (conn, id) => new Mux.Channel.Channel(conn, id, chan_deps);
const mux_deps = { channelFactory };

interface AppState {
    client?: Sessions.Client
    channels?: ChannelResolver
    control?: Net.Connection
    inGame: boolean
    connected: boolean
}

export default class App extends React.Component<unknown, AppState> {
    private voice?: VoiceLink;

    public constructor(props: unknown) {
        super(props);
        this.state = { inGame:false, connected:false };
    }

    private async connect(wsurl: string): Promise<Sessions.Client> {
        console.debug(wsurl);
        const client = new Sessions.Client(() => new Promise(res => {
            const ws = new WebSocket(wsurl);
            ws.onopen = () => res(new WsWrapper(ws));
        }));
        client.brokenPipe.on(() => this.setState({ connected: false }));
        client.resuming.on(() => this.setState({ connected: true }));
        client.closed.then(() => this.setState({ inGame: false }));
        await client.ready;
        this.setState({ inGame: true, connected: true });
        return client;
    }

    private async login(client: Sessions.Client, name: string): Promise<ChannelResolver> {
        console.log('client ready');
        client.send(name);
        const mux = new Mux.Host.Host(client, mux_deps);
        return new ChannelResolver(mux);
    }

    private async onLogin(data: LoginDetails) {
        const client = await this.connect(data.address);
        const channels = await this.login(client, data.name);
        // Start the game when we get a control channel, set up sound in the mean time
        channels.get('control').then(control => this.setState({ client, channels, control }));
        channels.get('voice').then(chan => VoiceLink.create(chan)).then(vl => this.voice = vl);
    }

    public render(): React.ReactNode {
        if (!this.state.inGame) {
            return <LoginForm title='Stars of Salem' onsubmit={data => this.onLogin(data)} />;
        } else {
            return <>
                {this.state.connected ? undefined : <ReconnectingOverlay/>}
                { (this.state.channels && this.state.control) ?
                    <Game channels={this.state.channels} control={this.state.control} /> 
                    : undefined }
            </>;
        }
    }
}